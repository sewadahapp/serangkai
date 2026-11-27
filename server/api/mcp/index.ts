import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { and, eq, isNull, like, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { toWebRequest } from 'h3'
import { rangkaVersions, rangkaItems, folders, oauthTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireScope } from '../../utils/require-auth'
import { readRangkaBytes, writeRangka } from '../../utils/rangka-storage'
import { checkTextRangka, reserveSlug } from '../../utils/rangka'
import { appendVersion } from '../../utils/rangka-versions'
import { byteLength, storageWriteRefusal } from '../../utils/storage-quota'
import { autoPruneVersions } from '../../utils/version-pruning'
import { deleteDocument, findOwnedRangka, getDocument, listCollections, listDocuments, RangkaDataError, writeDocument } from '../../utils/rangka-data'
import { isSlugConflict } from '../../db/migrations'
import { CONNECTION_LABEL_MAX, findGrantByApiTokenId, normalizeConnectionLabel, resourceMatches, setConnectionLabel } from '../../utils/oauth'
import { mcpResourceUrl, protectedResourceMetadataUrl, requestOrigin } from '../../utils/oauth-urls'
import { capabilities, capabilitiesText, htmlGuide, markdownGuide, promptMessages, templates } from '../../utils/authoring'
import { componentCatalogMarkdown } from '../../../shared/rangka-components'
import { selarasTokensGuide } from '../../../shared/selaras-tokens'

// Text content only. Bundles and PDFs are binary and go through the multipart
// upload; `image` is accepted as SVG markup (see `checkTextRangka`).
const rangkaType = z.enum(['markdown', 'html', 'javascript', 'json', 'image'])
const visibility = z.enum(['private', 'public', 'unlisted'])
const guideResources = [
  { name: 'Markdown authoring guide', uri: 'serangkai://guides/markdown', description: 'Comark Markdown, Selaras components, Mermaid, charts, and security limits.', text: markdownGuide },
  { name: 'HTML authoring guide', uri: 'serangkai://guides/html', description: 'Self-styled HTML, the optional Selaras document theme, markers, and sandbox rules.', text: htmlGuide },
  { name: 'Selaras component catalog', uri: 'serangkai://components/selaras', description: 'Supported component tags, props, slots, examples, and application-only exclusions.', text: componentCatalogMarkdown() },
  { name: 'Selaras design tokens', uri: 'serangkai://tokens/selaras', description: 'Theme-aware CSS custom properties for HTML rangka: surfaces, text, borders, primary/accent/secondary, radius, elevation.', text: selarasTokensGuide() },
] as const
const templateResources = Object.entries(templates).map(([name, text]) => ({ name: `Template: ${name}`, uri: `serangkai://templates/${name}`, description: `Starting ${name} rangka.`, text }))

// Successful results carry the same JSON twice: as `structuredContent`, which
// the SDK validates against the tool's `outputSchema`, and as text for clients
// that predate structured output. The round trip turns Dates into ISO strings,
// which is what crosses the wire either way.
function structuredResult<T extends Record<string, unknown>>(value: T) {
  const structuredContent = JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  return { structuredContent, content: [{ type: 'text' as const, text: JSON.stringify(structuredContent, null, 2) }] }
}

// Output schemas describe what each tool returns so clients can generate typed
// APIs from them (for example, clients that let the model call tools from code).
const timestamp = z.string().describe('ISO 8601 timestamp')
const folderOutput = z.object({
  id: z.string(),
  userId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  path: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
const rangkaOutput = z.object({
  id: z.string(),
  userId: z.string(),
  folderId: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  type: z.enum(['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle']),
  visibility,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

// Clients that support MCP server icons (spec 2025-11-25) show these next to
// the connection. URLs are absolute so each self-hosted instance serves its own.
export function mcpServerInfo(origin: string) {
  return {
    name: 'serangkai',
    title: 'Serangkai',
    version: '0.1.0',
    websiteUrl: origin,
    icons: [
      { src: `${origin}/favicon.svg`, mimeType: 'image/svg+xml', sizes: ['any'] },
      { src: `${origin}/icon-512.png`, mimeType: 'image/png', sizes: ['512x512'] },
      { src: `${origin}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] },
    ],
  }
}

function createMcpServer(userId: string, canWrite: boolean, db: any, grantId: string | null, origin: string) {
  const server = new McpServer(mcpServerInfo(origin), { maxToolInputElements: 100, instructions: 'Rangka are documents, files, and interactive content stored in the connected Serangkai workspace. Use create_rangka to create them in Serangkai and get_rangka/update_rangka to read or revise them. The workspace owns persistence, versions, folders, and sharing. HTML rangka can be documents, full-screen apps, or zoomable canvases such as kanban boards and whiteboards; get_rangka_capabilities explains each. Interactive HTML rangka keep live data, such as kanban cards, through serangkai.data; read_rangka_data and write_rangka_data read or seed it without creating a version.' })
  const findFolder = (folderId: string) => db.select().from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId))).get()

  server.registerTool('get_rangka_capabilities', {
    title: 'Get authoring capabilities',
    description: 'Discover supported rangka types, Markdown/HTML authoring, Selaras components, Mermaid, TanStack chart schema, and security limits. Use this before creating a rich rangka.',
    inputSchema: {},
    outputSchema: z.looseObject({ version: z.number() }),
    annotations: { readOnlyHint: true },
  }, async () => structuredResult(capabilities))

  server.registerTool('set_connection_name', {
    title: 'Name this connection',
    description: 'Name this connection so the Serangkai owner can tell it apart in Settings, where every install of the same app otherwise shows the same name. Use "<app> – <hostname> – <username>", for example "Claude Code – work-laptop – alex"; leave out any part you cannot determine. Call it once after connecting. It does not replace a name the owner chose.',
    inputSchema: { name: z.string().min(1).max(CONNECTION_LABEL_MAX) },
    outputSchema: { name: z.string(), applied: z.boolean() },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ name }) => {
    if (!grantId) {
      return { isError: true, content: [{ type: 'text', text: 'This connection uses an API token, which the owner names in Settings.' }] }
    }
    const label = normalizeConnectionLabel(name)
    if (!label) return { isError: true, content: [{ type: 'text', text: 'The name is empty.' }] }
    const applied = await setConnectionLabel(db, grantId, label, 'agent')
    if (applied) return structuredResult({ name: label, applied })
    // The owner already named it; report that name instead of failing.
    const current = await db.select({ label: oauthTokens.label }).from(oauthTokens).where(eq(oauthTokens.id, grantId)).get()
    return structuredResult({ name: current?.label || label, applied })
  })

  server.registerTool('list_folders', {
    title: 'List folders',
    description: 'List folders owned by the authenticated Serangkai user.',
    inputSchema: {},
    outputSchema: { folders: z.array(folderOutput) },
    annotations: { readOnlyHint: true },
  }, async () => {
    const rows = await db.select().from(folders).where(eq(folders.userId, userId))
    return structuredResult({ folders: rows })
  })

  server.registerTool('search', {
    title: 'Search workspace',
    description: 'Search rangka and folders by title, name, or slug.',
    inputSchema: { query: z.string().min(1), folderId: z.string().optional() },
    outputSchema: { rangka: z.array(rangkaOutput), folders: z.array(folderOutput) },
    annotations: { readOnlyHint: true },
  }, async ({ query, folderId }) => {
    const pattern = `%${query}%`
    const [matchedRangka, matchedFolders] = await Promise.all([
      db.select().from(rangkaItems).where(and(
        eq(rangkaItems.userId, userId),
        or(like(rangkaItems.title, pattern), like(rangkaItems.slug, pattern)),
      )),
      db.select().from(folders).where(and(eq(folders.userId, userId), like(folders.name, pattern))),
    ])
    let scopedRangka = matchedRangka
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
      scopedRangka = matchedRangka.filter(rangka => rangka.folderId && scope.has(rangka.folderId))
    }
    return structuredResult({
      rangka: scopedRangka.map(({ contentPath: _contentPath, ...row }) => row),
      folders: matchedFolders,
    })
  })

  server.registerTool('create_folder', {
    title: 'Create folder',
    description: 'Create a folder, optionally nested under an existing folder.',
    inputSchema: { name: z.string().min(1).max(120), parentId: z.string().optional() },
    outputSchema: { id: z.string(), name: z.string(), parentId: z.string().nullable(), path: z.string() },
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
    return structuredResult({ id, name, parentId: parentId || null, path })
  })

  server.registerTool('list_rangka', {
    title: 'List rangka',
    description: 'List rangka owned by the authenticated Serangkai user.',
    inputSchema: { query: z.string().optional() },
    outputSchema: { rangka: z.array(rangkaOutput) },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => {
    const rows = await db.select().from(rangkaItems).where(eq(rangkaItems.userId, userId))
    const filtered = query ? rows.filter(row => `${row.title} ${row.slug}`.toLowerCase().includes(query.toLowerCase())) : rows
    return structuredResult({ rangka: filtered.map(({ contentPath: _contentPath, ...row }) => row) })
  })

  server.registerTool('get_rangka', {
    title: 'Read rangka',
    description: 'Read the source of a rangka in the Serangkai workspace by id or slug.',
    inputSchema: { id: z.string().optional(), slug: z.string().optional() },
    outputSchema: {
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      type: rangkaOutput.shape.type,
      visibility,
      folderId: z.string().nullable(),
      currentVersion: z.number().int(),
      content: z.string(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ id, slug }) => {
    if (!id && !slug) return { isError: true, content: [{ type: 'text', text: 'Provide id or slug.' }] }
    const row = await db.select().from(rangkaItems).where(and(
      eq(rangkaItems.userId, userId), id ? eq(rangkaItems.id, id) : eq(rangkaItems.slug, slug!),
    )).get()
    if (!row) return { isError: true, content: [{ type: 'text', text: 'Rangka not found.' }] }
    const content = (await readRangkaBytes(row.contentPath)).toString()
    // An agent cannot publish without baseVersion, and this is where it learns
    // the current one. Omitting it here made the documented workflow impossible.
    const versionRows = await db.select({ version: rangkaVersions.version }).from(rangkaVersions).where(eq(rangkaVersions.rangkaId, row.id))
    const currentVersion = Math.max(0, ...versionRows.map(item => item.version))
    return structuredResult({ id: row.id, slug: row.slug, title: row.title, type: row.type, visibility: row.visibility, folderId: row.folderId, currentVersion, content })
  })

  server.registerTool('create_rangka', {
    title: 'Create rangka',
    description: 'Create a private-by-default rangka in the Serangkai workspace. For a board viewers zoom and pan, such as a kanban or whiteboard, create HTML with <meta name="serangkai-canvas" content="WIDTHxHEIGHT">. Call get_rangka_capabilities for authoring syntax and presentation modes.',
    inputSchema: {
      title: z.string().min(1).max(200),
      type: rangkaType,
      content: z.string().max(10_000_000),
      folderId: z.string().optional(),
      visibility: visibility.default('private'),
    },
    outputSchema: { id: z.string(), slug: z.string(), title: z.string(), type: rangkaType, visibility, folderId: z.string().nullable() },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ title, type, content, folderId, visibility: rangkaVisibility }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
    const id = nanoid()
    const slug = await reserveSlug(db, title)
    const checked = checkTextRangka(type, content, slug)
    if (!checked.ok) return { isError: true, content: [{ type: 'text', text: checked.message }] }
    const storedBytes = byteLength(content)
    const refusal = await storageWriteRefusal(db, userId, storedBytes)
    if (refusal) return { isError: true, content: [{ type: 'text', text: refusal }] }
    const contentPath = `${userId}/${id}/content`
    await writeRangka(contentPath, content)
    try {
      await db.insert(rangkaItems).values({ id, userId, folderId: folderId || null, slug, title, type, visibility: rangkaVisibility, contentPath, metadata: checked.metadata, createdAt: new Date(), updatedAt: new Date() })
    } catch (error) {
      if (isSlugConflict(error)) return { isError: true, content: [{ type: 'text', text: 'That share identifier is already in use. Retry with a slightly different title.' }] }
      throw error
    }
    await db.insert(rangkaVersions).values({ id: nanoid(), rangkaId: id, version: 1, contentPath, metadata: checked.metadata, storedBytes, createdAt: new Date() })
    return structuredResult({ id, slug, title, type, visibility: rangkaVisibility, folderId: folderId || null })
  })

  server.registerTool('update_rangka', {
    title: 'Update rangka',
    description: 'Publish a new version of a Serangkai rangka. baseVersion from get_rangka is required when content changes; a mismatch returns the current version. Call get_rangka_capabilities for authoring syntax. Unchanged content creates no version.',
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().max(10_000_000).optional(),
      visibility: visibility.optional(),
      folderId: z.string().nullable().optional(),
      baseVersion: z.number().int().positive().optional(),
    },
    outputSchema: {
      id: z.string(),
      title: z.string(),
      visibility,
      folderId: z.string().nullable(),
      contentPath: z.string(),
      versionCreated: z.boolean(),
      version: z.number().int(),
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ id, title, content, visibility: rangkaVisibility, folderId, baseVersion }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    const row = await db.select().from(rangkaItems).where(and(eq(rangkaItems.id, id), eq(rangkaItems.userId, userId))).get()
    if (!row) return { isError: true, content: [{ type: 'text', text: 'Rangka not found.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }

    const versionRows = await db.select({ version: rangkaVersions.version }).from(rangkaVersions).where(eq(rangkaVersions.rangkaId, id))
    const currentVersion = Math.max(0, ...versionRows.map(item => item.version))

    // Publish-time staleness check, mirroring Claude Code's behaviour: refuse a
    // write built on an older copy and hand back the current version so the
    // caller can re-read and merge instead of silently overwriting.
    if (content !== undefined && baseVersion === undefined) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `baseVersion is required when publishing content. The current version is ${currentVersion}. Call get_rangka, then publish with baseVersion ${currentVersion}.`,
        }],
      }
    }
    if (baseVersion !== undefined && baseVersion !== currentVersion) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Stale write refused: baseVersion ${baseVersion} but the current version is ${currentVersion}. Re-read the rangka with get_rangka, merge your changes, then publish again with baseVersion ${currentVersion}.`,
        }],
      }
    }

    let contentPath = row.contentPath
    let metadata = row.metadata || {}
    if (content !== undefined) {
      const checked = checkTextRangka(row.type, content, row.slug)
      if (!checked.ok) return { isError: true, content: [{ type: 'text', text: checked.message }] }
      metadata = { ...metadata, ...checked.metadata }
      // Only record a version when the bytes actually change. Agents commonly
      // re-save unchanged content, and unconditional inserts turned that into
      // duplicate history entries.
      const currentContent = (await readRangkaBytes(row.contentPath)).toString()
      if (currentContent !== content) {
        const refusal = await storageWriteRefusal(db, userId, byteLength(content))
        if (refusal) return { isError: true, content: [{ type: 'text', text: refusal }] }
        const version = currentVersion + 1
        contentPath = `${userId}/${id}/versions/${version}`
        const claimed = await appendVersion(db, { rangkaId: id, version, contentPath, metadata, content })
        if (!claimed) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Stale write refused: version ${version} was published by another writer. Re-read the rangka with get_rangka, merge your changes, then publish again with baseVersion ${version}.`,
            }],
          }
        }
      }
    }
    await db.update(rangkaItems).set({ ...(title === undefined ? {} : { title }), ...(rangkaVisibility === undefined ? {} : { visibility: rangkaVisibility }), ...(folderId === undefined ? {} : { folderId }), ...(content === undefined ? {} : { contentPath, metadata }), updatedAt: new Date() }).where(eq(rangkaItems.id, id))

    const versionCreated = contentPath !== row.contentPath
    if (versionCreated) await autoPruneVersions(db, userId, id)
    return structuredResult({
      id,
      title: title || row.title,
      visibility: rangkaVisibility || row.visibility,
      folderId: folderId === undefined ? row.folderId : folderId,
      contentPath,
      versionCreated,
      version: versionCreated ? currentVersion + 1 : currentVersion,
    })
  })

  const dataError = (error: unknown) => {
    if (error instanceof RangkaDataError) return { isError: true as const, content: [{ type: 'text' as const, text: error.message }] }
    throw error
  }
  const dataName = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
  const documentOutput = z.object({ id: z.string(), data: z.record(z.string(), z.unknown()), updatedAt: timestamp, updatedBy: z.string() })

  server.registerTool('read_rangka_data', {
    title: 'Read rangka data',
    description: 'Read the live data an interactive HTML rangka keeps, such as the cards on a kanban board. Without collection, lists the collections; with collection, lists its documents; with docId too, returns one document (null when missing). Data is separate from the rangka source and is not versioned.',
    inputSchema: { id: z.string(), collection: dataName.optional(), docId: dataName.optional() },
    outputSchema: {
      collections: z.array(z.object({ name: z.string(), count: z.number().int(), bytes: z.number().int() })).optional(),
      documents: z.array(documentOutput).optional(),
      document: documentOutput.nullable().optional(),
    },
    annotations: { readOnlyHint: true },
  }, async ({ id, collection, docId }) => {
    if (!(await findOwnedRangka(db, userId, id))) return { isError: true, content: [{ type: 'text', text: 'Rangka not found.' }] }
    try {
      if (!collection) {
        if (docId) return { isError: true, content: [{ type: 'text', text: 'Provide collection with docId.' }] }
        return structuredResult({ collections: await listCollections(db, id) })
      }
      if (docId) return structuredResult({ document: await getDocument(db, id, collection, docId) })
      return structuredResult({ documents: await listDocuments(db, id, collection) })
    } catch (error) {
      return dataError(error)
    }
  })

  server.registerTool('write_rangka_data', {
    title: 'Write rangka data',
    description: 'Create, update, or delete documents in an interactive HTML rangka\'s live data, for example adding cards to a kanban board. "set" replaces a document, "update" shallow-merges fields into it (creating it when missing), "delete" removes it. Documents are JSON objects up to 64 KB. Operations apply in order and stop at the first error. This does not create a rangka version.',
    inputSchema: {
      id: z.string(),
      operations: z.array(z.object({
        op: z.enum(['set', 'update', 'delete']),
        collection: dataName,
        docId: dataName,
        data: z.record(z.string(), z.unknown()).optional(),
      })).min(1).max(100),
    },
    outputSchema: {
      applied: z.number().int(),
      results: z.array(z.object({ op: z.string(), collection: z.string(), docId: z.string(), deleted: z.boolean().optional(), document: documentOutput.optional() })),
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, async ({ id, operations }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    if (!(await findOwnedRangka(db, userId, id))) return { isError: true, content: [{ type: 'text', text: 'Rangka not found.' }] }
    const results: Array<Record<string, unknown>> = []
    for (const operation of operations) {
      try {
        if (operation.op === 'delete') {
          const deleted = await deleteDocument(db, id, operation.collection, operation.docId)
          results.push({ op: operation.op, collection: operation.collection, docId: operation.docId, deleted })
          continue
        }
        if (!operation.data) throw new RangkaDataError(400, `"${operation.op}" needs data.`)
        const document = await writeDocument(db, {
          userId, rangkaId: id, collection: operation.collection, docId: operation.docId,
          data: operation.data, merge: operation.op === 'update', writer: 'agent',
        })
        results.push({ op: operation.op, collection: operation.collection, docId: operation.docId, document })
      } catch (error) {
        if (!(error instanceof RangkaDataError)) throw error
        return { isError: true, content: [{ type: 'text', text: `Operation ${results.length + 1} (${operation.op} ${operation.collection}/${operation.docId}) failed after ${results.length} applied: ${error.message}` }] }
      }
    }
    return structuredResult({ applied: results.length, results })
  })

  server.registerResource('Serangkai capabilities', 'serangkai://capabilities', {
    title: 'Serangkai authoring capabilities',
    description: 'Supported rangka types, rendering modes, components, charts, diagrams, and security limits.',
    mimeType: 'application/json',
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: capabilitiesText() }] }))

  for (const resource of guideResources) {
    server.registerResource(resource.name, resource.uri, {
      title: resource.name,
      description: resource.description,
      mimeType: 'text/markdown',
    }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: resource.text }] }))
  }

  for (const resource of templateResources) {
    server.registerResource(resource.name, resource.uri, {
      title: resource.name,
      description: resource.description,
      mimeType: 'text/markdown',
    }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: resource.text }] }))
  }

  const promptEntries = [
    ['create_report', 'Create a polished Markdown report.', promptMessages.createReport],
    ['create_dashboard', 'Create a Markdown dashboard with Selaras cards and a chart.', promptMessages.createDashboard],
    ['create_html_document', 'Create a styled HTML report with the Selaras document theme.', promptMessages.createHtmlDocument],
    ['create_custom_dashboard', 'Create a custom-designed HTML dashboard without Selaras styling.', promptMessages.createCustomDashboard],
    ['create_canvas_board', 'Create a zoomable, pannable HTML canvas, such as a kanban board with draggable cards.', promptMessages.createCanvasBoard],
  ] as const
  for (const [name, description, text] of promptEntries) {
    server.registerPrompt(name, { title: description, description }, async () => ({
      messages: [{ role: 'user', content: { type: 'text', text } }],
    }))
  }

  return server
}

export default defineEventHandler(async (event) => {
  // Agents authenticate with a scoped bearer token. A browser session must not
  // open the MCP endpoint, so there is no session fallback here.
  if (!event.context.apiToken) {
    // The WWW-Authenticate header is how an MCP client discovers OAuth at all.
    // Without it the client only sees a bare 401 and has no authorization
    // server to send the user to. RFC 9728 puts the metadata URL in
    // `resource_metadata`; RFC 6750 scope/error fields accompany it.
    //
    // An expired token is reported as `invalid_token` too — RFC 6750 has no
    // distinct expired code — but the error description tells the client this
    // is recoverable, so it refreshes instead of prompting the owner again.
    const expired = event.context.authFailure === 'expired_token'
    setHeader(
      event,
      'WWW-Authenticate',
      `Bearer error="invalid_token", error_description="${expired
        ? 'The access token has expired. Refresh it and retry.'
        : 'Sign in to connect this client.'}", scope="read write", resource_metadata="${protectedResourceMetadataUrl(event).href}"`,
    )
    throw createError({
      statusCode: 401,
      message: expired
        ? 'The access token has expired. Refresh it and retry.'
        : 'MCP requires an Authorization: Bearer <token> header.',
    })
  }
  const user = requireScope(event, 'read')
  const db = await getRequestDatabase(event)
  const token = event.context.apiToken

  // RFC 8707 audience binding: an OAuth access token is only valid for the MCP
  // resource it was issued for. Manual API tokens have no grant row and remain
  // usable here, as before.
  const grant = await findGrantByApiTokenId(db, token.id)
  if (grant) {
    const expectedResource = mcpResourceUrl(event).href
    if (grant.userId !== user.id) {
      throw createError({ statusCode: 401, message: 'The access token is not valid for this account.' })
    }
    if (grant.resource && !resourceMatches(grant.resource, expectedResource)) {
      setHeader(
        event,
        'WWW-Authenticate',
        `Bearer error="invalid_token", error_description="The access token was issued for a different resource. Start a new authorization.", resource_metadata="${protectedResourceMetadataUrl(event).href}"`,
      )
      throw createError({ statusCode: 401, message: 'The access token was issued for a different resource.' })
    }
    // Grants created before audience binding existed are adopted on first use.
    // The conditional update keeps concurrent requests from writing twice.
    if (!grant.resource) {
      await db.update(oauthTokens)
        .set({ resource: expectedResource })
        .where(and(eq(oauthTokens.id, grant.id), isNull(oauthTokens.resource)))
    }
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 10_000_000,
  })
  const canWrite = token.scopes.includes('write') || token.scopes.includes('full')
  const server = createMcpServer(user.id, canWrite, db, grant?.id ?? null, requestOrigin(event))
  await server.connect(transport)
  return transport.handleRequest(toWebRequest(event))
})
