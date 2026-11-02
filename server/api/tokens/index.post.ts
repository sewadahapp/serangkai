import { nanoid } from 'nanoid'
import { apiTokens } from '../../db'
import { getRequestDatabase } from '../../db/adapter'
import { generateToken, hashToken } from '../../utils/auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default(['read', 'write']),
  expiresAt: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { name, scopes, expiresAt } = result.data
  const token = generateToken()
  const tokenHash = hashToken(token)
  
  const tokenId = nanoid()
  await db.insert(apiTokens).values({
    id: tokenId,
    userId: user.id,
    name,
    tokenHash,
    scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdAt: new Date(),
  })
  
  return { token, id: tokenId, name, scopes }
})
