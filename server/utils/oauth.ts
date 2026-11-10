import { and, eq, gt, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { apiTokens, oauthClients, oauthCodes, oauthDeviceCodes, oauthTokens } from '../db/schema'
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
 *
 * A non-empty request that names no supported scope returns an empty list. It
 * must not fall back to the default: a client asking only for `full` would
 * otherwise be handed read+write without ever asking for them.
 */
export function normalizeScopes(requested: unknown): OAuthScope[] {
  const raw = Array.isArray(requested)
    ? requested.map(value => String(value)).join(' ')
    : typeof requested === 'string' ? requested : ''
  const parsed = parseScopes(requested)
  if (parsed.length) return parsed
  return raw.trim() ? [] : [...DEFAULT_OAUTH_SCOPES]
}

/**
 * Compare an RFC 8707 resource indicator with the canonical resource this
 * server protects. The comparison is structural rather than a raw string
 * match so `https://example.com:443/api/mcp` and `https://EXAMPLE.com/api/mcp`
 * are recognized as the same audience, while a different origin, path, query,
 * fragment, or embedded credential is not.
 */
export function resourceMatches(requested: string, expected: string): boolean {
  try {
    const actual = new URL(requested)
    const target = new URL(expected)
    return actual.protocol === target.protocol
      && actual.host === target.host
      && actual.pathname === target.pathname
      && !actual.search
      && !actual.hash
      && !actual.username
      && !actual.password
  } catch {
    return false
  }
}

/**
 * Resolve the `resource` parameter for a request.
 *
 * Omitted is safe here: Serangkai exposes exactly one MCP resource, so the
 * documented default is that resource. A supplied value must name it exactly;
 * anything else is rejected rather than silently substituted. The returned
 * value is canonical, which keeps stored grants stable across equivalent URL
 * spellings.
 */
export function parseResourceIndicator(
  requested: unknown,
  expected: string,
): { ok: true; resource: string } | { ok: false } {
  if (requested === undefined || requested === null || requested === '') {
    return { ok: true, resource: expected }
  }
  if (typeof requested !== 'string') return { ok: false }
  const value = requested.trim()
  if (!value) return { ok: true, resource: expected }
  if (!resourceMatches(value, expected)) return { ok: false }
  return { ok: true, resource: expected }
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
export async function consumeAuthorizationCode(db: any, code: string, expectedResource?: string) {
  const id = await sha256Hex(code)
  const row = await db.select().from(oauthCodes).where(eq(oauthCodes.id, id)).get()
  if (!row || row.consumedAt) return { ok: false as const, error: 'invalid_grant' as const }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: 'invalid_grant' as const }
  // Audience mismatch is checked before the code is claimed, so a client that
  // sent the wrong `resource` can retry the same code correctly.
  if (expectedResource && row.resource && !resourceMatches(row.resource, expectedResource)) {
    return { ok: false as const, error: 'invalid_target' as const }
  }

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
  /** RFC 8707 audience this grant is bound to. */
  resource?: string | null
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  scopes: string[]
}

/**
 * Read an affected-row count from any supported driver. An unrecognized shape
 * is zero, which fails closed: callers only proceed when they can prove their
 * conditional write won.
 */
function affectedRows(result: any): number {
  const value = result?.changes ?? result?.rowsAffected ?? result?.meta?.changes
  const count = Number(value)
  return Number.isFinite(count) ? count : 0
}

/**
 * Mint an access token plus a rotating refresh token.
 *
 * The access token is stored in `api_tokens` so the existing request middleware
 * authenticates it with no special case. The OAuth row carries the client and
 * refresh state that a hand-minted token does not have. Both rows are written
 * atomically: a failure must not leave a usable token with no grant behind.
 */
export async function issueTokens(db: any, input: IssueTokensInput): Promise<IssuedTokens> {
  const { apiTokenRow, grantRow, tokens } = await buildTokenRows(input)

  if (typeof db.batch === 'function') {
    // D1: one batch is atomic, and there is no BEGIN/COMMIT.
    await db.batch([
      db.insert(apiTokens).values(apiTokenRow),
      db.insert(oauthTokens).values(grantRow),
    ])
  } else if (typeof db.transaction === 'function') {
    db.transaction((tx: any) => {
      tx.insert(apiTokens).values(apiTokenRow).run()
      tx.insert(oauthTokens).values(grantRow).run()
    })
  } else {
    // Test doubles that provide neither primitive keep the old shape.
    await db.insert(apiTokens).values(apiTokenRow)
    await db.insert(oauthTokens).values(grantRow)
  }

  return tokens
}

/**
 * Build the two rows a grant is made of. Shared by `issueTokens` and the
 * device-code redemption, which must write them in the same atomic step as
 * the single-use claim.
 */
async function buildTokenRows(input: IssueTokensInput) {
  const accessToken = generateToken()
  const refreshToken = generateToken()
  const apiTokenId = nanoid()
  const grantId = nanoid()
  const now = Date.now()
  // Sanitize again at the storage boundary. A legacy or tampered row must never
  // turn into a `full` OAuth credential.
  const scopes = parseScopes(input.scopes)

  const apiTokenRow = {
    id: apiTokenId,
    userId: input.userId,
    name: input.label,
    tokenHash: await hashToken(accessToken),
    scopes,
    expiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    createdAt: new Date(),
  }
  const grantRow = {
    id: grantId,
    clientId: input.clientId,
    userId: input.userId,
    apiTokenId,
    scopes,
    resource: input.resource || null,
    accessExpiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    refreshTokenHash: await sha256Hex(refreshToken),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
    createdAt: new Date(),
  }
  const tokens: IssuedTokens = { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scopes }
  return { apiTokenRow, grantRow, apiTokenId, grantId, tokens }
}

export type RotateRefreshResult =
  | { ok: true; tokens: IssuedTokens }
  | { ok: false; error: 'invalid_grant' | 'invalid_target' }

/**
 * Exchange a refresh token for a new pair.
 *
 * Rotation must be atomic across concurrent requests and across instances.
 * Reading the row and then deleting it leaves a window where two requests both
 * believe they won, each minting a live token. Instead the refresh hash is
 * replaced by a conditional UPDATE; only the request whose UPDATE reports one
 * affected row returns a token. The loser's freshly inserted token is removed
 * in the same transaction/batch.
 *
 * The grant id is stable, so Settings keeps listing one connection across
 * refreshes.
 */
export async function rotateRefreshToken(
  db: any,
  refreshToken: string,
  clientId?: string,
  expectedResource?: string,
): Promise<RotateRefreshResult> {
  const hash = await sha256Hex(refreshToken)
  const now = Date.now()

  const row = await db.select().from(oauthTokens).where(eq(oauthTokens.refreshTokenHash, hash)).get()
  if (!row) return { ok: false, error: 'invalid_grant' }
  if (clientId && row.clientId !== clientId) return { ok: false, error: 'invalid_grant' }
  if (expectedResource && row.resource && !resourceMatches(row.resource, expectedResource)) {
    return { ok: false, error: 'invalid_target' }
  }
  const scopes = parseScopes(row.scopes)
  if (!scopes.length) return { ok: false, error: 'invalid_grant' }
  const resource = row.resource || expectedResource || null

  // The old token and grant are dead once the grant expires; clean them up
  // without minting anything.
  if (row.refreshExpiresAt.getTime() < now) {
    await revokeGrant(db, row.id)
    return { ok: false, error: 'invalid_grant' }
  }

  const accessToken = generateToken()
  const newRefreshToken = generateToken()
  const apiTokenId = nanoid()
  const client = await findClient(db, row.clientId)
  const apiTokenRow = {
    id: apiTokenId,
    userId: row.userId,
    name: client?.clientName || 'OAuth client',
    tokenHash: await hashToken(accessToken),
    scopes,
    expiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    createdAt: new Date(),
  }
  const grantUpdate = {
    apiTokenId,
    scopes,
    resource,
    accessExpiresAt: new Date(now + ACCESS_TTL_SECONDS * 1000),
    refreshTokenHash: await sha256Hex(newRefreshToken),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
  }
  const tokens: IssuedTokens = {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    scopes,
  }

  if (typeof db.batch === 'function') {
    // D1: all four statements commit together. The conditional UPDATE is the
    // single winner; the trailing deletes clean up the loser's orphan token.
    const results = await db.batch([
      db.insert(apiTokens).values(apiTokenRow),
      db.update(oauthTokens).set(grantUpdate).where(and(
        eq(oauthTokens.id, row.id),
        eq(oauthTokens.refreshTokenHash, hash),
      )),
      db.delete(apiTokens).where(and(
        eq(apiTokens.id, row.apiTokenId),
        sql`NOT EXISTS (SELECT 1 FROM oauth_tokens WHERE id = ${row.id} AND api_token_id = ${row.apiTokenId})`,
      )),
      db.delete(apiTokens).where(and(
        eq(apiTokens.id, apiTokenId),
        sql`NOT EXISTS (SELECT 1 FROM oauth_tokens WHERE api_token_id = ${apiTokenId})`,
      )),
    ])
    if (affectedRows(results?.[1]) !== 1) return { ok: false, error: 'invalid_grant' }
    return { ok: true, tokens }
  }

  if (typeof db.transaction === 'function') {
    const result = db.transaction((tx: any): RotateRefreshResult => {
      tx.insert(apiTokens).values(apiTokenRow).run()
      const updated = tx.update(oauthTokens).set(grantUpdate).where(and(
        eq(oauthTokens.id, row.id),
        eq(oauthTokens.refreshTokenHash, hash),
      )).run()
      if (affectedRows(updated) !== 1) {
        // Another request rotated first. Remove the token this attempt created
        // and fail closed.
        tx.delete(apiTokens).where(eq(apiTokens.id, apiTokenId)).run()
        return { ok: false, error: 'invalid_grant' }
      }
      tx.delete(apiTokens).where(eq(apiTokens.id, row.apiTokenId)).run()
      return { ok: true, tokens }
    })
    return result
  }

  // Test doubles without transactions: still use the conditional UPDATE so the
  // correctness property (one winner) is preserved.
  await db.insert(apiTokens).values(apiTokenRow)
  const updated = await db.update(oauthTokens).set(grantUpdate).where(and(
    eq(oauthTokens.id, row.id),
    eq(oauthTokens.refreshTokenHash, hash),
  ))
  if (affectedRows(updated) !== 1) {
    await db.delete(apiTokens).where(eq(apiTokens.id, apiTokenId))
    return { ok: false, error: 'invalid_grant' }
  }
  await db.delete(apiTokens).where(eq(apiTokens.id, row.apiTokenId))
  return { ok: true, tokens }
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
 * Resolve the OAuth grant behind an `api_tokens` row. Manual tokens have no
 * grant and return undefined, which is how the MCP endpoint distinguishes an
 * audience-bound OAuth credential from a hand-minted token.
 */
export async function findGrantByApiTokenId(db: any, apiTokenId: string) {
  return db.select().from(oauthTokens).where(eq(oauthTokens.apiTokenId, apiTokenId)).get()
}

export interface ConsentFingerprintInput {
  clientId: string
  redirectUri: string
  responseType: string
  codeChallenge: string
  codeChallengeMethod: string
  scopes: string[]
  state: string
  resource: string
  userId: string
}

/**
 * Bind a consent POST to the GET that rendered it.
 *
 * The fingerprint covers every value that decides where the code goes and what
 * it can do, plus the owner id. It is stored in the sealed session by the GET
 * and compared by the POST, so a cross-site form cannot approve a request the
 * owner never saw. No client-side JavaScript or hidden CSRF token is needed.
 */
export async function oauthConsentFingerprint(input: ConsentFingerprintInput): Promise<string> {
  return sha256Hex(JSON.stringify([
    input.clientId,
    input.redirectUri,
    input.responseType,
    input.codeChallenge,
    input.codeChallengeMethod,
    input.scopes.join(' '),
    input.state,
    input.resource,
    input.userId,
  ]))
}

export interface DeviceConsentFingerprintInput {
  /** Row id (the hashed device code) of the stored authorization request. */
  deviceId: string
  clientId: string
  userCode: string
  /** The permissions displayed on the consent page, from the stored row. */
  scopes: string[]
  resource: string
  userId: string
}

/**
 * Bind a device approval/denial POST to the consent page the owner rendered.
 *
 * Every value comes from the stored device authorization, not from the POST
 * body, so tampering with the submitted code or scopes cannot match the
 * fingerprint. The domain prefix keeps these hashes distinct from
 * authorization-code consent hashes.
 */
export async function deviceConsentFingerprint(input: DeviceConsentFingerprintInput): Promise<string> {
  return sha256Hex(JSON.stringify([
    'device',
    input.deviceId,
    input.clientId,
    input.userCode,
    input.scopes.join(' '),
    input.resource,
    input.userId,
  ]))
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

/**
 * RFC 8628 device authorization grant.
 *
 * The point is to move the browser off the machine running the client: an SSH
 * session, container, or cron job cannot receive a loopback callback, but it
 * can print a short code that the owner types on a page opened anywhere.
 *
 * Security properties:
 *  - The device code is stored hashed and is single use.
 *  - The user code is short by design, so it is only accepted while pending,
 *    within its lifetime, and after a single approval; guessing it yields
 *    `authorization_pending` rather than a token.
 *  - Approval always requires the owner's browser session, exactly like the
 *    consent page.
 */
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000

/** Ambiguous characters (0/O, 1/I/L) are omitted so a human can read it back. */
const USER_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXZ'

/** A short, human-readable code like `WDJB-MJHT`. */
export function generateUserCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, byte => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/** Normalize what a human typed: case and separators do not matter. */
export function normalizeUserCode(input: string): string {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatUserCode(normalized: string): string {
  return normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized
}

export interface DeviceAuthorizationInput {
  clientId: string
  scopes: string[]
  resource?: string | null
}

/**
 * Bound the rows one client can keep alive. Expired rows are pruned on every
 * create, but within the TTL a scripted client could otherwise pile up records
 * without limit. A human connecting devices never approaches this.
 */
const MAX_LIVE_DEVICE_CODES_PER_CLIENT = 100

export type CreateDeviceAuthorizationResult =
  | { ok: true; deviceCode: string; userCode: string; expiresIn: number }
  | { ok: false; error: 'slow_down' }

export async function createDeviceAuthorization(db: any, input: DeviceAuthorizationInput): Promise<CreateDeviceAuthorizationResult> {
  // Opportunistic cleanup, same rationale as authorization codes.
  await db.delete(oauthDeviceCodes).where(lt(oauthDeviceCodes.expiresAt, new Date()))

  const live = await db.select({ id: oauthDeviceCodes.id })
    .from(oauthDeviceCodes)
    .where(and(eq(oauthDeviceCodes.clientId, input.clientId), gt(oauthDeviceCodes.expiresAt, new Date())))
    .limit(MAX_LIVE_DEVICE_CODES_PER_CLIENT)
  if (live.length >= MAX_LIVE_DEVICE_CODES_PER_CLIENT) {
    return { ok: false, error: 'slow_down' }
  }

  const deviceCode = generateToken()
  // Collisions are possible in principle; retry a few times rather than
  // surfacing a unique-constraint error to the client.
  let userCode = normalizeUserCode(generateUserCode())
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db.select({ id: oauthDeviceCodes.id })
      .from(oauthDeviceCodes).where(eq(oauthDeviceCodes.userCode, userCode)).get()
    if (!clash) break
    userCode = normalizeUserCode(generateUserCode())
  }

  await db.insert(oauthDeviceCodes).values({
    id: await sha256Hex(deviceCode),
    clientId: input.clientId,
    userCode,
    scopes: input.scopes,
    resource: input.resource || null,
    expiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS),
    createdAt: new Date(),
  })

  return { ok: true, deviceCode, userCode: formatUserCode(userCode), expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000) }
}

/** Look up a pending device authorization by the code the owner typed. */
export async function findDeviceByUserCode(db: any, input: string) {
  const userCode = normalizeUserCode(input)
  if (userCode.length !== 8) return undefined
  return db.select().from(oauthDeviceCodes)
    .where(eq(oauthDeviceCodes.userCode, userCode)).get()
}

/**
 * Owner approval. Sets the user and marks the request approved.
 *
 * The conditional UPDATE is the decision: under concurrent approve/deny
 * requests exactly one affects a row, and a zero-row result must be reported
 * as "already decided", never as success.
 */
export async function approveDeviceAuthorization(db: any, id: string, userId: string, scopes: string[]) {
  const row = await db.select().from(oauthDeviceCodes).where(eq(oauthDeviceCodes.id, id)).get()
  if (!row) return { ok: false as const, error: 'not_found' as const }
  if (row.approvedAt || row.deniedAt || row.consumedAt) return { ok: false as const, error: 'already_decided' as const }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: 'expired' as const }

  const result = await db.update(oauthDeviceCodes)
    .set({ userId, approvedAt: new Date(), scopes })
    .where(and(
      eq(oauthDeviceCodes.id, id),
      isNull(oauthDeviceCodes.approvedAt),
      isNull(oauthDeviceCodes.deniedAt),
      isNull(oauthDeviceCodes.consumedAt),
    ))
  if (affectedRows(result) !== 1) return { ok: false as const, error: 'already_decided' as const }
  return { ok: true as const }
}

export async function denyDeviceAuthorization(db: any, id: string) {
  const row = await db.select().from(oauthDeviceCodes).where(eq(oauthDeviceCodes.id, id)).get()
  if (!row) return { ok: false as const, error: 'not_found' as const }
  if (row.approvedAt || row.deniedAt || row.consumedAt) return { ok: false as const, error: 'already_decided' as const }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: 'expired' as const }
  const result = await db.update(oauthDeviceCodes)
    .set({ deniedAt: new Date() })
    .where(and(
      eq(oauthDeviceCodes.id, id),
      isNull(oauthDeviceCodes.approvedAt),
      isNull(oauthDeviceCodes.deniedAt),
      isNull(oauthDeviceCodes.consumedAt),
    ))
  if (affectedRows(result) !== 1) return { ok: false as const, error: 'already_decided' as const }
  return { ok: true as const }
}

/**
 * Poll result for the token endpoint.
 *
 * Returns the RFC 8628 error code the client expects while the owner has not
 * decided yet. Once approved, claiming the code and issuing its tokens are one
 * atomic step: a failure rolls both back so the code stays redeemable, and
 * concurrent polls produce exactly one token pair. The claim stores the minted
 * API token id on the device row, which lets the loser of a race recognize and
 * clean up its own inserts inside the same batch/transaction.
 */
export async function pollDeviceAuthorization(
  db: any,
  deviceCode: string,
  clientId?: string,
  expectedResource?: string,
) {
  const id = await sha256Hex(deviceCode)
  const row = await db.select().from(oauthDeviceCodes).where(eq(oauthDeviceCodes.id, id)).get()
  if (!row) return { ok: false as const, error: 'invalid_grant' as const }
  // The device code is bound to the client that requested it. Without this
  // check any registered client could redeem a code it observed.
  if (clientId && row.clientId !== clientId) return { ok: false as const, error: 'invalid_grant' as const }
  if (expectedResource && row.resource && !resourceMatches(row.resource, expectedResource)) {
    return { ok: false as const, error: 'invalid_target' as const }
  }
  if (row.consumedAt) return { ok: false as const, error: 'invalid_grant' as const }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, error: 'expired_token' as const }
  if (row.deniedAt) return { ok: false as const, error: 'access_denied' as const }
  if (!row.approvedAt || !row.userId) return { ok: false as const, error: 'authorization_pending' as const }
  const scopes = parseScopes(row.scopes)
  if (!scopes.length) return { ok: false as const, error: 'invalid_grant' as const }

  const client = await findClient(db, row.clientId)
  const { apiTokenRow, grantRow, apiTokenId, grantId, tokens } = await buildTokenRows({
    clientId: row.clientId,
    userId: row.userId,
    scopes,
    label: client?.clientName || 'OAuth client',
    resource: row.resource || expectedResource || null,
  })

  const claim = { consumedAt: new Date(), apiTokenId }
  const claimWhere = and(eq(oauthDeviceCodes.id, id), isNull(oauthDeviceCodes.consumedAt))
  // Only the request whose claim linked this API token keeps it; everyone
  // else's inserts are removed in the same atomic step.
  const orphanGrant = and(
    eq(oauthTokens.id, grantId),
    sql`NOT EXISTS (SELECT 1 FROM oauth_device_codes WHERE id = ${id} AND api_token_id = ${apiTokenId})`,
  )
  const orphanToken = and(
    eq(apiTokens.id, apiTokenId),
    sql`NOT EXISTS (SELECT 1 FROM oauth_device_codes WHERE id = ${id} AND api_token_id = ${apiTokenId})`,
  )

  if (typeof db.batch === 'function') {
    // D1: all five statements commit together; the conditional claim is the
    // single winner and the trailing deletes clean up the loser's rows.
    const results = await db.batch([
      db.insert(apiTokens).values(apiTokenRow),
      db.insert(oauthTokens).values(grantRow),
      db.update(oauthDeviceCodes).set(claim).where(claimWhere),
      db.delete(oauthTokens).where(orphanGrant),
      db.delete(apiTokens).where(orphanToken),
    ])
    if (affectedRows(results?.[2]) !== 1) return { ok: false as const, error: 'invalid_grant' as const }
    return { ok: true as const, tokens }
  }

  if (typeof db.transaction === 'function') {
    return db.transaction((tx: any) => {
      tx.insert(apiTokens).values(apiTokenRow).run()
      tx.insert(oauthTokens).values(grantRow).run()
      const updated = tx.update(oauthDeviceCodes).set(claim).where(claimWhere).run()
      if (affectedRows(updated) !== 1) {
        tx.delete(oauthTokens).where(eq(oauthTokens.id, grantId)).run()
        tx.delete(apiTokens).where(eq(apiTokens.id, apiTokenId)).run()
        return { ok: false as const, error: 'invalid_grant' as const }
      }
      return { ok: true as const, tokens }
    })
  }

  // Test doubles without transactions: the conditional claim still guarantees
  // a single winner, and a loser removes its own rows.
  await db.insert(apiTokens).values(apiTokenRow)
  await db.insert(oauthTokens).values(grantRow)
  const updated = await db.update(oauthDeviceCodes).set(claim).where(claimWhere)
  if (affectedRows(updated) !== 1) {
    await db.delete(oauthTokens).where(eq(oauthTokens.id, grantId))
    await db.delete(apiTokens).where(eq(apiTokens.id, apiTokenId))
    return { ok: false as const, error: 'invalid_grant' as const }
  }
  return { ok: true as const, tokens }
}
