import { and, eq } from 'drizzle-orm'
import { apiTokens, oauthClients, oauthTokens } from '../../db/schema'
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
    label: oauthTokens.label,
    labelSetBy: oauthTokens.labelSetBy,
    clientName: oauthClients.clientName,
    clientUri: oauthClients.clientUri,
    lastUsedAt: apiTokens.lastUsedAt,
  })
    .from(oauthTokens)
    .leftJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
    // The current access token. A refresh replaces it and stamps its last
    // use, so this stays accurate across refreshes.
    .leftJoin(apiTokens, eq(oauthTokens.apiTokenId, apiTokens.id))
    .where(eq(oauthTokens.userId, user.id))

  return {
    clients: rows.map((row: any) => ({
      id: row.id,
      clientId: row.clientId,
      // The connection's own name when it has one; clients all register with
      // their app name, so this is what tells two installs apart.
      name: row.label || row.clientName || 'Unnamed client',
      clientName: row.clientName || 'Unnamed client',
      named: Boolean(row.label),
      namedBy: row.label ? row.labelSetBy : null,
      lastUsedAt: row.lastUsedAt,
      uri: row.clientUri || '',
      scopes: row.scopes || [],
      connectedAt: row.createdAt,
      accessExpiresAt: row.accessExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
    })),
  }
})
