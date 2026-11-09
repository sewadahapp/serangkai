import { apiTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireSessionUser } from '../../utils/require-auth'
import { eq } from 'drizzle-orm'

/**
 * List hand-minted API tokens.
 *
 * Browser session only. Listing tokens is credential management, not a read of
 * workspace content, so a `read`-scoped bearer token must not reach it — and an
 * OAuth grant must certainly not be able to enumerate its siblings.
 */
export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireSessionUser(event)

  const tokens = await db.select({
    id: apiTokens.id,
    name: apiTokens.name,
    scopes: apiTokens.scopes,
    lastUsedAt: apiTokens.lastUsedAt,
    expiresAt: apiTokens.expiresAt,
    createdAt: apiTokens.createdAt,
  }).from(apiTokens).where(eq(apiTokens.userId, user.id))

  return { tokens }
})
