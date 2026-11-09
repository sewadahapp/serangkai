import { and, eq, inArray, isNull, lt, notInArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { apiTokens, oauthClients, oauthCodes, oauthTokens } from '../db/schema'
import { generateToken, hashToken } from './auth'

/**
 * OAuth 2.1 authorization server for MCP clients.
 *
 * Serangkai is the authorization server as well as the resource server: there
 * is one owner and one login, so proxying to an external IdP would add a second
 * system to configure for no benefit. Discovery documents are built from the
 * incoming request origin (see `oauth-urls.ts`), so a self-hosted deployment
 * works at whatever URL it happens to be served from.
 *
 * Deliberate limits:
 *  - Only `read` and `write` can be granted. `full` can mint and revoke API
 *    tokens, so an agent connected over OAuth must never receive it.
 *  - PKCE (`S256`) is required, and there is no implicit flow.
 *  - Authorization codes are single-use and expire in five minutes.
 *  - Refresh tokens rotate: each refresh replaces the hash, so a replayed token
 *    fails instead of silently extending the grant.
 */

/** Scopes an OAuth client may request. `full` is intentionally absent. */
export const OAUTH_SCOPES = ['read', 'write'] as const
export type OAuthScope = typeof OAUTH_SCOPES[number]

export const DEFAULT_OAUTH_SCOPES: OAuthScope[] = ['read', 'write']

const CODE_TTL_MS = 5 * 60 * 1000
const ACCESS_TTL_SECONDS = 60 * 60
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface OAuthClientRecord {
  id: string
  clientName: string | null
  clientUri: string | null
  redirectUris: string[]
  scopes: string[]
  tokenEndpointAuthMethod: string
  clientSecretHash: string | null
  createdAt: Date
}

/**
 * Parse a scope value into the grantable set, preserving order and dropping
 * anything unsupported. Returns an empty array for empty input — no default.
 *
 * Callers decide what an empty request means. A client asking for nothing gets
 * the default set; an owner unchecking every box must get a denial, not the
 * default back. Conflating those two is a privilege bug.
 */
export function parseScopes(requested: unknown): OAuthScope[] {
  const list = Array.isArray(requested)
    ? requested
    : typeof requested === 'string' ? requested.split(/\s+/) : []
  const allowed = new Set<string>(OAUTH_SCOPES)
  const seen = new Set<OAuthScope>()
  for (const value of list) {
    const scope = String(value).trim() as OAuthScope
    if (allowed.has(scope)) seen.add(scope)
  }
  return [...seen]
}

/**
 * Scopes for a client's authorization request. An empty request means "whatever
 * the client needs", so it defaults to read+write rather than issuing a token
 * that cannot do anything.
 */
export function normalizeScopes(requested: unknown): OAuthScope[] {
  const parsed = parseScopes(requested)
  return parsed.length ? parsed : [...DEFAULT_OAUTH_SCOPES]
}

/**
 * Exact redirect-URI match, with the RFC 8252 §7.3 exception for loopback
 * clients: a native client picks an ephemeral port at runtime, so the port is
 * ignored there. Every other component must match byte for byte — a loose
 * match here is a redirect to an attacker.
 */
export function redirectUriMatches(requested: string, registered: string): boolean {
  if (requested === registered) return true
  let a: URL
  let b: URL
  try {
    a = new URL(requested)
    b = new URL(registered)
  } catch {
    return false
  }
  if (a.protocol !== b.protocol || a.hostname !== b.hostname) return false
  if (!isLoopbackHostname(a.hostname)) return false
  // Loopback: same path, query, and hash; any port. Both must be http or https.
  return a.pathname === b.pathname && a.search === b.search && a.hash === b.hash
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]' || hostname === 'localhost'
}

/** Whether any registered URI matches the requested one. */
export function anyRedirectMatches(requested: string, registered: string[]): boolean {
  return registered.some(uri => redirectUriMatches(requested, uri))
}

/**
 * Reject a registration whose redirect URI is not a plausible OAuth callback:
 * an HTTPS URL, or an HTTP loopback URL. Custom schemes are also allowed for
 * native apps (`myapp://callback`), which is what RFC 8252 recommends.
 */
export function isAcceptableRedirectUri(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.hash) return false
    if (url.protocol === 'https:') return true
    if (url.protocol === 'http:') return isLoopbackHostname(url.hostname)
    // A custom scheme is a native-app callback; it must still name a host.
    if (!/^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) return false
    return value.includes('://') && value.length > url.protocol.length + 3
  } catch {
    return false
  }
}

/** SHA-256 hex digest, used for both tokens and PKCE verification. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Base64url without padding, as PKCE requires. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Verify an S256 PKCE challenge against the verifier the client presents. */
export async function verifyPkce(codeChallenge: string, codeVerifier: string): Promise<boolean> {
  if (!codeChallenge || !codeVerifier) return false
  // RFC 7636: the verifier is 43-128 characters from the unreserved set.
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false
  const computed = base64UrlEncode(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)),
  ))
  return timingSafeEqual(computed, codeChallenge)
}

/** Constant-time string comparison, so token checks do not leak by timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index++) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

export async function findClient(db: any, clientId: string): Promise<OAuthClientRecord | undefined> {
  return db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).get()
}

export interface CreateCodeInput {
  clientId: string
  userId: string
  redirectUri: string
  scopes: string[]
  codeChallenge: string
  codeChallengeMethod: string
  resource?: string | null
}

/** Persist a single-use authorization code and return its plaintext value. */
export async function createAuthorizationCode(db: any, input: CreateCodeInput): Promise<string> {
  // Opportunistic cleanup: expired codes are useless, and nothing else prunes
  // them on an instance that is only used occasionally.
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, new Date()))

  const code = generateToken()
  await db.insert(oauthCodes).values({
    // The row is keyed by the hash, so the database never holds a usable code.
    id: await sha256Hex(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod || 'S256',
    resource: input.resource || null,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    createdAt: new Date(),
  })
  return code
}

/**
 * Consume a code exactly once.
 *
 * The UPDATE is conditional on `consumed_at IS NULL`, so the loser of a
 * concurrent exchange updates zero rows. The affected-row count is read from
 * each driver's own shape: bun-sqlite/better-sqlite3 report `changes`, D1
 * reports `meta.changes`. An unrecognized shape is treated as "not consumed"
 * so this fails closed rather than letting a replay through.
 */
export async function consumeAuthorizationCode(db: any, code: string) {
  const id = await sha256Hex(code)
  const row = await db.select().from(oauthCodes).where(eq(oauthCodes.id, id)).get()
  if (!row || row.consumedAt) return { ok: false as const, error: 'invalid_grant' as const }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: 'invalid_grant' as const }

  const result = await db.update(oauthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(oauthCodes.id, id), isNull(oauthCodes.consumedAt)))

  const affected = Number(
    result?.changes
    ?? result?.rowsAffected
    ?? result?.meta?.changes,
  )
  if (!Number.isFinite(affected) || affected <= 0) {
    return { ok: false as const, error: 'invalid_grant' as const }
  }
  return { ok: true as const, code: row }
}

export interface IssueTokensInput {
  clientId: string
  userId: string
  scopes: string[]
  /** Label shown in Settings so the owner can tell grants apart. */
  label: string
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scopes: string[]
}

/**
 * Mint an access token plus a rotating refresh token.
 *
 * The access token is stored in `api_tokens` so the existing request middleware
 * authenticates it with no special case. The OAuth row carries the client and
 * refresh state that a hand-minted token does not have.
 */
export async function issueTokens(db: any, input: IssueTokensInput): Promise<IssuedTokens> {
  const accessToken = generateToken()
  const refreshToken = generateToken()
  const apiTokenId = nanoid()
  const now = Date.now()

  await db.insert(apiTokens).values({
    id: apiTokenId,
    userId: input.userId,
    name: input.label,
    tokenHash: await hashToken(accessToken),
    scopes: input.scopes,
    expiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    createdAt: new Date(),
  })

  await db.insert(oauthTokens).values({
    id: nanoid(),
    clientId: input.clientId,
    userId: input.userId,
    apiTokenId,
    scopes: input.scopes,
    accessExpiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    refreshTokenHash: await sha256Hex(refreshToken),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
    createdAt: new Date(),
  })

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scopes: input.scopes }
}

/**
 * Exchange a refresh token for a new pair. The grant row is updated in place,
 * so the presented refresh token stops working as soon as this returns.
 */
export async function rotateRefreshToken(db: any, refreshToken: string, clientId?: string) {
  const hash = await sha256Hex(refreshToken)
  const row = await db.select().from(oauthTokens).where(eq(oauthTokens.refreshTokenHash, hash)).get()
  if (!row) return { ok: false as const, error: 'invalid_grant' as const }
  if (clientId && row.clientId !== clientId) return { ok: false as const, error: 'invalid_grant' as const }
  if (row.refreshExpiresAt.getTime() < Date.now()) {
    await revokeGrant(db, row.id)
    return { ok: false as const, error: 'invalid_grant' as const }
  }

  // Rotate: delete the old access token so it cannot outlive its grant, then
  // reissue both halves.
  await db.delete(apiTokens).where(eq(apiTokens.id, row.apiTokenId))
  await db.delete(oauthTokens).where(eq(oauthTokens.id, row.id))

  const client = await findClient(db, row.clientId)
  const issued = await issueTokens(db, {
    clientId: row.clientId,
    userId: row.userId,
    scopes: row.scopes,
    label: client?.clientName || 'OAuth client',
  })
  return { ok: true as const, tokens: issued }
}

/** Revoke one grant: the access token and the OAuth row disappear together. */
export async function revokeGrant(db: any, grantId: string) {
  const row = await db.select().from(oauthTokens).where(eq(oauthTokens.id, grantId)).get()
  if (!row) return false
  await db.delete(apiTokens).where(eq(apiTokens.id, row.apiTokenId))
  await db.delete(oauthTokens).where(eq(oauthTokens.id, grantId))
  return true
}

/** Resolve the grant behind an access token, for revocation by token value. */
export async function findGrantByAccessToken(db: any, accessToken: string) {
  const tokenHash = await hashToken(accessToken)
  const token = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).get()
  if (!token) return undefined
  return db.select().from(oauthTokens).where(eq(oauthTokens.apiTokenId, token.id)).get()
}

/** Resolve the grant behind a refresh token. */
export async function findGrantByRefreshToken(db: any, refreshToken: string) {
  const hash = await sha256Hex(refreshToken)
  return db.select().from(oauthTokens).where(eq(oauthTokens.refreshTokenHash, hash)).get()
}

/**
 * Delete abandoned registrations and expired codes.
 *
 * A client registers *before* the browser flow, so any abandoned sign-in leaves
 * a row behind. Nothing references an unapproved client, and its cascade takes
 * any stray code with it, so removing it is safe. Only rows that never produced
 * a grant and are older than the retention window are touched — an approved
 * client is never pruned here.
 *
 * Runs opportunistically on registration rather than on a timer, because a
 * single-owner instance may sit idle for days and a scheduled job would need a
 * cron binding on some runtimes and not others.
 */
export async function pruneAbandonedClients(db: any, olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs)
  const grantedClients = db.select({ clientId: oauthTokens.clientId }).from(oauthTokens)
  const stale = await db.select({ id: oauthClients.id })
    .from(oauthClients)
    .where(and(lt(oauthClients.createdAt, cutoff), notInArray(oauthClients.id, grantedClients)))
    .limit(100)
  if (!stale.length) return 0
  const ids = stale.map((row: { id: string }) => row.id)
  await db.delete(oauthClients).where(inArray(oauthClients.id, ids))
  return ids.length
}
