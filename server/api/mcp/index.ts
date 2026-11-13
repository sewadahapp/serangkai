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
import { isSlugConflict } from '../../db/migrations'
import { findGrantByApiTokenId, resourceMatches } from '../../utils/oauth'
import { mcpResourceUrl, protectedResourceMetadataUrl } from '../../utils/oauth-urls'
import { capabilities, capabilitiesText, htmlGuide, markdownGuide, promptMessages, templates } from '../../utils/authoring'
import { componentCatalogMarkdown } from '../../../shared/rangka-components'
import { selarasTokensGuide } from '../../../shared/selaras-tokens'

// Text content only. Bundles and PDFs are binary and go through the multipart
// upload; `image` is accepted as SVG markup (see `checkTextRangka`).
const rangkaType = z.enum(['markdown', 'html', 'javascript', 'json', 'image'])
const guideResources = [
  { name: 'Markdown authoring guide', uri: 'serangkai://guides/markdown', description: 'Comark Markdown, Selaras components, Mermaid, charts, and security limits.', text: markdownGuide },
  { name: 'HTML authoring guide', uri: 'serangkai://guides/html', description: 'Self-styled HTML, the optional Selaras document theme, markers, and sandbox rules.', text: htmlGuide },
  { name: 'Selaras component catalog', uri: 'serangkai://components/selaras', description: 'Supported component tags, props, slots, examples, and application-only exclusions.', text: componentCatalogMarkdown() },
  { name: 'Selaras design tokens', uri: 'serangkai://tokens/selaras', description: 'Theme-aware CSS custom properties for HTML rangka: surfaces, text, borders, primary/accent/secondary, radius, elevation.', text: selarasTokensGuide() },
] as const
const templateResources = Object.entries(templates).map(([name, text]) => ({ name: `Template: ${name}`, uri: `serangkai://templates/${name}`, description: `Starting ${name} rangka.`, text }))
const visibility = z.enum(['private', 'public', 'unlisted'])

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function createMcpServer(userId: string, canWrite: boolean, db: any) {
  const server = new McpServer({ name: 'serangkai', version: '0.1.0' }, { maxToolInputElements: 100, instructions: 'Rangka are documents, files, and interactive content stored in the connected Serangkai workspace. Use create_rangka to create them in Serangkai and get_rangka/update_rangka to read or revise them. The workspace owns persistence, versions, folders, and sharing.' })
  const findFolder = (folderId: string) => db.select().from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId))).get()

  server.registerTool('get_rangka_capabilities', {
    title: 'Get authoring capabilities',
    description: 'Discover supported rangka types, Markdown/HTML authoring, Selaras components, Mermaid, TanStack chart schema, and security limits. Use this before creating a rich rangka.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => textResult(capabilities))

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
    description: 'Search rangka and folders by title, name, or slug.',
    inputSchema: { query: z.string().min(1), folderId: z.string().optional() },
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
    return textResult({
      rangka: scopedRangka.map(({ contentPath: _contentPath, ...row }) => row),
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

  server.registerTool('list_rangka', {
    title: 'List rangka',
    description: 'List rangka owned by the authenticated Serangkai user.',
    inputSchema: { query: z.string().optional() },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => {
    const rows = await db.select().from(rangkaItems).where(eq(rangkaItems.userId, userId))
    const filtered = query ? rows.filter(row => `${row.title} ${row.slug}`.toLowerCase().includes(query.toLowerCase())) : rows
    return textResult(filtered.map(({ contentPath: _contentPath, ...row }) => row))
  })

  server.registerTool('get_rangka', {
    title: 'Read rangka',
    description: 'Read the source of a rangka in the Serangkai workspace by id or slug.',
    inputSchema: { id: z.string().optional(), slug: z.string().optional() },
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
    return textResult({ id: row.id, slug: row.slug, title: row.title, type: row.type, visibility: row.visibility, folderId: row.folderId, currentVersion, content })
  })

  server.registerTool('create_rangka', {
    title: 'Create rangka',
    description: 'Create a private-by-default rangka in the Serangkai workspace. Call get_rangka_capabilities for authoring syntax.',
    inputSchema: {
      title: z.string().min(1).max(200),
      type: rangkaType,
      content: z.string().max(10_000_000),
      folderId: z.string().optional(),
      visibility: visibility.default('private'),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ title, type, content, folderId, visibility: rangkaVisibility }) => {
    if (!canWrite) return { isError: true, content: [{ type: 'text', text: 'This API token requires write scope.' }] }
    if (folderId && !(await findFolder(folderId))) return { isError: true, content: [{ type: 'text', text: 'Folder not found.' }] }
    const id = nanoid()
    const slug = await reserveSlug(db, title)
    const checked = checkTextRangka(type, content, slug)
    if (!checked.ok) return { isError: true, content: [{ type: 'text', text: checked.message }] }
    const contentPath = `${userId}/${id}/content`
    await writeRangka(contentPath, content)
    try {
      await db.insert(rangkaItems).values({ id, userId, folderId: folderId || null, slug, title, type, visibility: rangkaVisibility, contentPath, metadata: checked.metadata, createdAt: new Date(), updatedAt: new Date() })
    } catch (error) {
      if (isSlugConflict(error)) return { isError: true, content: [{ type: 'text', text: 'That share identifier is already in use. Retry with a slightly different title.' }] }
      throw error
    }
    await db.insert(rangkaVersions).values({ id: nanoid(), rangkaId: id, version: 1, contentPath, metadata: checked.metadata, createdAt: new Date() })
    return textResult({ id, slug, title, type, visibility: rangkaVisibility, folderId: folderId || null })
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
    return textResult({
      id,
      title: title || row.title,
      visibility: rangkaVisibility || row.visibility,
      folderId: folderId === undefined ? row.folderId : folderId,
      contentPath,
      versionCreated,
      version: versionCreated ? currentVersion + 1 : currentVersion,
    })
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
  const server = createMcpServer(user.id, canWrite, db)
  await server.connect(transport)
  return transport.handleRequest(toWebRequest(event))
})
