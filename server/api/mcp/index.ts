import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { toWebRequest } from 'h3'
import { artifactVersions, artifacts, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { getRequestStorage } from '#serangkai-storage-runtime'
import { requireScope } from '../../utils/require-auth'

const artifactType = z.enum(['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle'])
const visibility = z.enum(['private', 'public', 'unlisted'])

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function createMcpServer(userId: string, canWrite: boolean, db: any, storage: any) {
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

  server.registerTool('create_folder', {
    title: 'Create folder',
    description: 'Create a folder, optionally nested under an existing folder.',
    inputSchema: { name: z.string().min(1).max(120), parentId: z.string().optional() },
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
    const content = (await storage.read(row.contentPath)).toString()
    return textResult({ id: row.id, slug: row.slug, title: row.title, type: row.type, visibility: row.visibility, folderId: row.folderId, content })
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
  }, async ({ title, type, content, folderId, visibility: artifactVisibility }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
    const id = nanoid()
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}-${nanoid(6)}`
    const contentPath = `${userId}/${id}/content`
    await storage.save(contentPath, content)
    await db.insert(artifacts).values({ id, userId, folderId: folderId || null, slug, title, type, visibility: artifactVisibility, contentPath, metadata: {}, createdAt: new Date(), updatedAt: new Date() })
    await db.insert(artifactVersions).values({ id: nanoid(), artifactId: id, version: 1, contentPath, metadata: {}, createdAt: new Date() })
    return textResult({ id, slug, title, type, visibility: artifactVisibility, folderId: folderId || null })
  })

  server.registerTool('update_artifact', {
    title: 'Update artifact',
    description: 'Update an artifact and create a new immutable version when content changes.',
    inputSchema: {
      id: z.string(), title: z.string().min(1).max(200).optional(), content: z.string().max(10_000_000).optional(), visibility: visibility.optional(), folderId: z.string().nullable().optional(),
    },
  }, async ({ id, title, content, visibility: artifactVisibility, folderId }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    const row = await db.select().from(artifacts).where(and(eq(artifacts.id, id), eq(artifacts.userId, userId))).get()
    if (!row) return { isError: true, content: [{ type: 'text', text: 'Artifact not found.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
    let contentPath = row.contentPath
    if (content !== undefined) {
      const versions = await db.select({ version: artifactVersions.version }).from(artifactVersions).where(eq(artifactVersions.artifactId, id))
      const version = Math.max(0, ...versions.map(item => item.version)) + 1
      contentPath = `${userId}/${id}/versions/${version}`
      await storage.save(contentPath, content)
      await db.insert(artifactVersions).values({ id: nanoid(), artifactId: id, version, contentPath, metadata: row.metadata || {}, createdAt: new Date() })
    }
    await db.update(artifacts).set({ ...(title === undefined ? {} : { title }), ...(artifactVisibility === undefined ? {} : { visibility: artifactVisibility }), ...(folderId === undefined ? {} : { folderId }), ...(content === undefined ? {} : { contentPath }), updatedAt: new Date() }).where(eq(artifacts.id, id))
    return textResult({ id, title: title || row.title, visibility: artifactVisibility || row.visibility, folderId: folderId === undefined ? row.folderId : folderId, contentPath })
  })

  return server
}

export default defineEventHandler(async (event) => {
  const user = requireScope(event, 'read')
  const db = await getRequestDatabase(event)
  const storage = getRequestStorage(event)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 10_000_000,
  })
  const token = event.context.apiToken
  const canWrite = !token || token.scopes.includes('write') || token.scopes.includes('full')
  const server = createMcpServer(user.id, canWrite, db, storage)
  await server.connect(transport)
  return transport.handleRequest(toWebRequest(event))
})
