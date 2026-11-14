import { nanoid } from 'nanoid'
import { rangkaItems, rangkaVersions, folders } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { z } from 'zod'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { isSlugConflict } from '../../db/migrations'
import { checkTextRangka, reserveSlug } from '../../utils/rangka'
import { writeRangka } from '../../utils/rangka-storage'

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
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { title, slug: providedSlug, type, content, folderId, visibility, metadata } = result.data
  const slug = await reserveSlug(db, providedSlug || title)
  const checked = checkTextRangka(type, content, slug)
  if (!checked.ok) throw createError({ statusCode: 400, message: checked.message })
  // The derived image type wins over author metadata, so a caller cannot
  // relabel SVG markup as something else.
  const storedMetadata = { ...(metadata || {}), ...checked.metadata }

  if (folderId) {
    const folder = await db.select().from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, user.id))).get()
    if (!folder) {
      throw createError({ statusCode: 400, message: 'Folder not found' })
    }
  }
  
  const rangkaId = nanoid()
  const contentKey = `${user.id}/${rangkaId}/content`
  await writeRangka(contentKey, content)
  
  try {
    await db.insert(rangkaItems).values({
      id: rangkaId,
      userId: user.id,
      folderId: folderId || null,
      slug,
      title,
      type,
      visibility,
      contentPath: contentKey,
      metadata: storedMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  } catch (error) {
    // A concurrent create can win the unique slug index between the check and
    // the insert; surface it as a retryable conflict instead of a 500.
    if (isSlugConflict(error)) throw createError({ statusCode: 409, message: 'That share identifier is already in use. Retry with a different slug.' })
    throw error
  }

  await db.insert(rangkaVersions).values({
    id: nanoid(),
    rangkaId,
    version: 1,
    contentPath: contentKey,
    metadata: storedMetadata,
    createdAt: new Date(),
  })
  
  return { rangka: { id: rangkaId, slug, title, type, visibility, folderId: folderId || null } }
})
