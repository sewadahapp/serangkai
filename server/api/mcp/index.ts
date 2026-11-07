import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { and, eq, like, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { toWebRequest } from 'h3'
import { artifactVersions, artifacts, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { readArtifactBytes, writeArtifact } from '../../utils/artifact-storage'

const artifactType = z.enum(['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle'])
const visibility = z.enum(['private', 'public', 'unlisted'])

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function createMcpServer(userId: string, canWrite: boolean, db: any) {
  const server = new McpServer({ name: 'serangkai', version: '0.1.0' }, { maxToolInputElements: 100 })
  const findFolder = (folderId: string) => db.select().from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId))).get()

  server.registerTool('list_folders', {
    title: 'List folders',
    description: 'List folders owned by the authenticated Serangkai user.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => {
    const rows = await db.select().from(folders).where(eq(folders.userId, userId))
    return textResult(rows)
  })

  server.registerTool('search', {
    title: 'Search workspace',
    description: 'Search artifacts and folders by title, name, or slug.',
    inputSchema: { query: z.string().min(1), folderId: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ query, folderId }) => {
    const pattern = `%${query}%`
    const [matchedArtifacts, matchedFolders] = await Promise.all([
      db.select().from(artifacts).where(and(
        eq(artifacts.userId, userId),
        or(like(artifacts.title, pattern), like(artifacts.slug, pattern)),
      )),
      db.select().from(folders).where(and(eq(folders.userId, userId), like(folders.name, pattern))),
    ])
    let scopedArtifacts = matchedArtifacts
    if (folderId) {
      const owned = await findFolder(folderId)
      if (!owned) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
      const allFolders = await db.select().from(folders).where(eq(folders.userId, userId))
      const scope = new Set([folderId])
      let changed = true
      while (changed) {
        changed = false
        for (const folder of allFolders) {
          if (folder.parentId && scope.has(folder.parentId) && !scope.has(folder.id)) {
            scope.add(folder.id)
            changed = true
          }
        }
      }
      scopedArtifacts = matchedArtifacts.filter(artifact => artifact.folderId && scope.has(artifact.folderId))
    }
    return textResult({
      artifacts: scopedArtifacts.map(({ contentPath: _contentPath, ...row }) => row),
      folders: matchedFolders,
    })
  })

  server.registerTool('create_folder', {
    title: 'Create folder',
    description: 'Create a folder, optionally nested under an existing folder.',
    inputSchema: { name: z.string().min(1).max(120), parentId: z.string().optional() },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ name, parentId }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    let path = `/${name}`
    if (parentId) {
      const parent = await findFolder(parentId)
      if (!parent) return { isError: true, content: [{ type: 'text', text: 'Parent folder not found.' }] }
      path = `${parent.path}/${name}`
    }
    const id = nanoid()
    await db.insert(folders).values({ id, userId, parentId: parentId || null, name, path, createdAt: new Date(), updatedAt: new Date() })
    return textResult({ id, name, parentId: parentId || null, path })
  })

  server.registerTool('list_artifacts', {
    title: 'List artifacts',
    description: 'List artifacts owned by the authenticated Serangkai user.',
    inputSchema: { query: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => {
    const rows = await db.select().from(artifacts).where(eq(artifacts.userId, userId))
    const filtered = query ? rows.filter(row => `${row.title} ${row.slug}`.toLowerCase().includes(query.toLowerCase())) : rows
    return textResult(filtered.map(({ contentPath: _contentPath, ...row }) => row))
  })

  server.registerTool('get_artifact', {
    title: 'Read artifact',
    description: 'Read the source of an artifact by id or slug.',
    inputSchema: { id: z.string().optional(), slug: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ id, slug }) => {
    if (!id && !slug) return { isError: true, content: [{ type: 'text', text: 'Provide id or slug.' }] }
    const row = await db.select().from(artifacts).where(and(
      eq(artifacts.userId, userId), id ? eq(artifacts.id, id) : eq(artifacts.slug, slug!),
    )).get()
    if (!row) return { isError: true, content: [{ type: 'text', text: 'Artifact not found.' }] }
    const content = (await readArtifactBytes(row.contentPath)).toString()
    // An agent cannot publish without baseVersion, and this is where it learns
    // the current one. Omitting it here made the documented workflow impossible.
    const versionRows = await db.select({ version: artifactVersions.version }).from(artifactVersions).where(eq(artifactVersions.artifactId, row.id))
    const currentVersion = Math.max(0, ...versionRows.map(item => item.version))
    return textResult({ id: row.id, slug: row.slug, title: row.title, type: row.type, visibility: row.visibility, folderId: row.folderId, currentVersion, content })
  })

  server.registerTool('create_artifact', {
    title: 'Create artifact',
    description: 'Create a private-by-default artifact in the authenticated workspace.',
    inputSchema: {
      title: z.string().min(1).max(200),
      type: artifactType,
      content: z.string().max(10_000_000),
      folderId: z.string().optional(),
      visibility: visibility.default('private'),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ title, type, content, folderId, visibility: artifactVisibility }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
    const id = nanoid()
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-${nanoid(6)}`
    const contentPath = `${userId}/${id}/content`
    await writeArtifact(contentPath, content)
    await db.insert(artifacts).values({ id, userId, folderId: folderId || null, slug, title, type, visibility: artifactVisibility, contentPath, metadata: {}, createdAt: new Date(), updatedAt: new Date() })
    await db.insert(artifactVersions).values({ id: nanoid(), artifactId: id, version: 1, contentPath, metadata: {}, createdAt: new Date() })
    return textResult({ id, slug, title, type, visibility: artifactVisibility, folderId: folderId || null })
  })

  server.registerTool('update_artifact', {
    title: 'Update artifact',
    description: 'Publish a new version of an artifact. baseVersion (the version you read with get_artifact) is required whenever content changes; a mismatch is refused with the current version so you can re-read and merge. Unchanged content creates no version.',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().max(10_000_000).optional(),
      visibility: visibility.optional(),
      folderId: z.string().nullable().optional(),
      baseVersion: z.number().int().positive().optional(),
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ id, title, content, visibility: artifactVisibility, folderId, baseVersion }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    const row = await db.select().from(artifacts).where(and(eq(artifacts.id, id), eq(artifacts.userId, userId))).get()
    if (!row) return { isError: true, content: [{ type: 'text', text: 'Artifact not found.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }

    const versionRows = await db.select({ version: artifactVersions.version }).from(artifactVersions).where(eq(artifactVersions.artifactId, id))
    const currentVersion = Math.max(0, ...versionRows.map(item => item.version))

    // Publish-time staleness check, mirroring Claude Code's behaviour: refuse a
    // write built on an older copy and hand back the current version so the
    // caller can re-read and merge instead of silently overwriting.
    if (content !== undefined && baseVersion === undefined) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `baseVersion is required when publishing content. The current version is ${currentVersion}. Call get_artifact, then publish with baseVersion ${currentVersion}.`,
        }],
      }
    }
    if (baseVersion !== undefined && baseVersion !== currentVersion) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Stale write refused: baseVersion ${baseVersion} but the current version is ${currentVersion}. Re-read the artifact with get_artifact, merge your changes, then publish again with baseVersion ${currentVersion}.`,
        }],
      }
    }

    let contentPath = row.contentPath
    if (content !== undefined) {
      // Only record a version when the bytes actually change. Agents commonly
      // re-save unchanged content, and unconditional inserts turned that into
      // duplicate history entries.
      const currentContent = (await readArtifactBytes(row.contentPath)).toString()
      if (currentContent !== content) {
        const version = currentVersion + 1
        contentPath = `${userId}/${id}/versions/${version}`
        await writeArtifact(contentPath, content)
        await db.insert(artifactVersions).values({ id: nanoid(), artifactId: id, version, contentPath, metadata: row.metadata || {}, createdAt: new Date() })
      }
    }
    await db.update(artifacts).set({ ...(title === undefined ? {} : { title }), ...(artifactVisibility === undefined ? {} : { visibility: artifactVisibility }), ...(folderId === undefined ? {} : { folderId }), ...(content === undefined ? {} : { contentPath }), updatedAt: new Date() }).where(eq(artifacts.id, id))

    const versionCreated = contentPath !== row.contentPath
    return textResult({
      id,
      title: title || row.title,
      visibility: artifactVisibility || row.visibility,
      folderId: folderId === undefined ? row.folderId : folderId,
      contentPath,
      versionCreated,
      version: versionCreated ? currentVersion + 1 : currentVersion,
    })
  })

  return server
}

export default defineEventHandler(async (event) => {
  const user = requireScope(event, 'read')
  const db = await getRequestDatabase(event)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 10_000_000,
  })
  const token = event.context.apiToken
  const canWrite = !token || token.scopes.includes('write') || token.scopes.includes('full')
  const server = createMcpServer(user.id, canWrite, db)
  await server.connect(transport)
  return transport.handleRequest(toWebRequest(event))
})
