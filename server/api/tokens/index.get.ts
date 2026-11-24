import { apiTokens, oauthTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireSessionUser } from '../../utils/require-auth'
import { and, eq, isNull } from 'drizzle-orm'

/**
 * List hand-minted API tokens.
 *
 * Browser session only. Listing tokens is credential management, not a read of
 * workspace content, so a `read`-scoped bearer token must not reach it — and an
 * OAuth grant must certainly not be able to enumerate its siblings.
 *
 * OAuth access tokens live in the same table but belong to a connected client;
 * they are listed and revoked under `/api/oauth/clients`, so they are left out.
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
  })
    .from(apiTokens)
    .leftJoin(oauthTokens, eq(oauthTokens.apiTokenId, apiTokens.id))
    .where(and(eq(apiTokens.userId, user.id), isNull(oauthTokens.id)))

  return { tokens }
})
