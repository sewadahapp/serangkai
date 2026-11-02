import { db, artifacts } from '../../db'
import { requireScope } from '../../utils/require-auth'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })
  await db.delete(artifacts).where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id)))
  return { message: 'Artifact deleted' }
})
