import { rangkaItems } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { eq } from 'drizzle-orm'
import { renderMarkdownContent } from '../../utils/markdown'
import { readRangkaBytes } from '../../utils/rangka-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID required' })
  }

  const rangka = await db.select().from(rangkaItems).where(eq(rangkaItems.id, id)).get()
  if (!rangka || rangka.userId !== user.id) {
    throw createError({ statusCode: 404, message: 'Rangka not found' })
  }

  // Binary rangka are previewed/downloaded through dedicated endpoints;
  // do not inflate them into a string for the metadata response.
  const isBinary = rangka.type === 'image' || rangka.type === 'pdf' || rangka.type === 'bundle'
  const content = isBinary ? Buffer.alloc(0) : await readRangkaBytes(rangka.contentPath)

  const markdown = rangka.type === 'markdown' ? await renderMarkdownContent(content.toString()) : null

  return {
    rangka: {
      id: rangka.id,
      slug: rangka.slug,
      title: rangka.title,
      type: rangka.type,
      visibility: rangka.visibility,
      folderId: rangka.folderId,
      metadata: rangka.metadata,
      createdAt: rangka.createdAt,
      updatedAt: rangka.updatedAt
    },
    content: content.toString(),
    body: markdown?.body ?? null,
    toc: markdown?.toc ?? [],
    startsWithHeading: markdown?.startsWithHeading ?? false,
  }
})
