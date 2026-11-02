import { db, artifacts, folders } from '../../db'
import { storage } from '../../storage'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const body = await readBody(event)
  const { method, params } = body
  
  // Basic MCP JSON-RPC style handling
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: body.id,
      result: {
        tools: [
          {
            name: 'list_artifacts',
            description: 'List all artifacts',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'get_artifact',
            description: 'Get an artifact by slug or id',
            inputSchema: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                id: { type: 'string' }
              }
            }
          },
          {
            name: 'create_artifact',
            description: 'Create a new artifact',
            inputSchema: {
              type: 'object',
              required: ['title', 'type', 'content'],
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['markdown', 'html', 'javascript', 'json'] },
                content: { type: 'string' },
                folderId: { type: 'string' },
                visibility: { type: 'string', enum: ['private', 'public'] }
              }
            }
          },
          {
            name: 'update_artifact',
            description: 'Update an existing artifact',
            inputSchema: {
              type: 'object',
              required: ['id', 'content'],
              properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                title: { type: 'string' }
              }
            }
          }
        ]
      }
    }
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params
    
    if (name === 'list_artifacts') {
      const userArtifacts = await db.select().from(artifacts).where(eq(artifacts.userId, user.id))
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify(userArtifacts, null, 2) }] }
      }
    } else if (name === 'get_artifact') {
      let artifact
      if (args.slug) {
        artifact = await db.select().from(artifacts).where(eq(artifacts.slug, args.slug)).get()
      } else if (args.id) {
        artifact = await db.select().from(artifacts).where(eq(artifacts.id, args.id)).get()
      }
      if (!artifact || artifact.userId !== user.id) {
        throw createError({ statusCode: 404, message: 'Artifact not found' })
      }
      const content = await storage.read(artifact.contentPath)
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: content.toString() }] }
      }
    } else if (name === 'create_artifact') {
      const { title, type, content, folderId, visibility = 'private' } = args
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + nanoid(6)
      const artifactId = nanoid()
      const contentKey = `${user.id}/${artifactId}/content`
      await storage.save(contentKey, content)
      
      await db.insert(artifacts).values({
        id: artifactId,
        userId: user.id,
        folderId: folderId || null,
        slug,
        title,
        type,
        visibility,
        contentPath: contentKey,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      
      return {
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ id: artifactId, slug, title }, null, 2) }] }
      }
    }
  }
  
  return { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }
})
