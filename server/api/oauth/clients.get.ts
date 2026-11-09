import { and, eq } from 'drizzle-orm'
import { oauthClients, oauthTokens } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { requireSessionUser } from '../../utils/require-auth'

/**
 * Connected OAuth clients.
 *
 * A grant row is one connection: an MCP client the owner approved. Listing them
 * is what makes that consent revocable. Hand-minted API tokens stay a separate
 * surface so revoking an agent cannot disable a script, or the reverse.
 */
export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireSessionUser(event)

  const rows = await db.select({
    id: oauthTokens.id,
    clientId: oauthTokens.clientId,
    scopes: oauthTokens.scopes,
    createdAt: oauthTokens.createdAt,
    accessExpiresAt: oauthTokens.accessExpiresAt,
    refreshExpiresAt: oauthTokens.refreshExpiresAt,
    clientName: oauthClients.clientName,
    clientUri: oauthClients.clientUri,
  })
    .from(oauthTokens)
    .leftJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
    .where(eq(oauthTokens.userId, user.id))

  return {
    clients: rows.map((row: any) => ({
      id: row.id,
      clientId: row.clientId,
      name: row.clientName || 'Unnamed client',
      uri: row.clientUri || '',
      scopes: row.scopes || [],
      connectedAt: row.createdAt,
      accessExpiresAt: row.accessExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
    })),
  }
})
