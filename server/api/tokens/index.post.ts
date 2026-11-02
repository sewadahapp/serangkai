import { nanoid } from 'nanoid'
import { apiTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { generateToken, hashToken } from '../../utils/auth'
import { requireScope } from '../../utils/require-auth'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(['read', 'write', 'full'])).min(1).default(['read', 'write']),
  expiresAt: z.string().datetime({ offset: true }).optional(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  // Only a session or a full-scope token may mint new tokens; a write-scoped
  // token must not be able to escalate itself to full access.
  const user = requireScope(event, 'full')

  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }

  const { name, scopes, expiresAt } = result.data
  const token = generateToken()
  const tokenHash = await hashToken(token)

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
