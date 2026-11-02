import { db, artifacts } from '../../db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const userArtifacts = await db.select().from(artifacts).where(eq(artifacts.userId, user.id))
  return { artifacts: userArtifacts }
})
