import { getRequestDatabase } from '../../db/adapter'
import { findGrantByAccessToken, findGrantByRefreshToken, revokeGrant } from '../../utils/oauth'

/**
 * RFC 7009 token revocation.
 *
 * Per the spec the response is the same whether or not the token existed, so a
 * caller cannot probe for valid tokens. Revoking an access token removes the
 * whole grant (its refresh token too): a client that disconnects should not
 * keep a way back in.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Cache-Control', 'no-store')

  const body = await readBody<Record<string, any>>(event).catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) {
    setResponseStatus(event, 400)
    return { error: 'invalid_request', error_description: 'token is required.' }
  }

  const db = await getRequestDatabase(event)
  // The token may be either half of the pair; both revoke the whole grant.
  const grant = await findGrantByAccessToken(db, token) || await findGrantByRefreshToken(db, token)
  if (grant) await revokeGrant(db, grant.id)

  return {}
})
