import { nanoid } from 'nanoid'
import { db, artifacts, artifactVersions } from '../../db'
import { storage } from '../../storage'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  type: z.enum(['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle']),
  content: z.string(),
  folderId: z.string().optional(),
  visibility: z.enum(['private', 'public', 'unlisted']).default('private'),
  metadata: z.record(z.any()).optional(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { title, slug: providedSlug, type, content, folderId, visibility, metadata } = result.data
  const slug = providedSlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + nanoid(6)
  
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
    metadata: metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  await db.insert(artifactVersions).values({
    id: nanoid(),
    artifactId,
    version: 1,
    contentPath: contentKey,
    metadata: metadata || {},
    createdAt: new Date(),
  })
  
  return { artifact: { id: artifactId, slug, title, type, visibility } }
})
