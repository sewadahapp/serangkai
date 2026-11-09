import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  // Nullable only for databases created before the single-owner migration.
  // The startup owner bootstrap always fills it in.
  username: text('username'),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

/**
 * OAuth clients that completed dynamic registration (RFC 7591).
 *
 * MCP clients register themselves before the authorization flow, so this table
 * is the pending/untrusted end of the surface: a row only becomes useful after
 * the owner approves it on the consent screen. Redirect URIs are stored as a
 * JSON array and matched exactly, except for loopback ports (RFC 8252 §7.3).
 */
export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  clientName: text('client_name'),
  clientUri: text('client_uri'),
  redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull().default([]),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
  // Token-endpoint auth method advertised to the client. MCP clients use
  // `none` with PKCE; a secret is kept for confidential clients.
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('none'),
  clientSecretHash: text('client_secret_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

/**
 * Short-lived authorization codes. Consumed exactly once, bound to a PKCE
 * challenge, and never reused.
 */
export const oauthCodes = sqliteTable('oauth_codes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
  resource: text('resource'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

/**
 * OAuth-granted tokens.
 *
 * Kept separate from API tokens on purpose: a connected agent must never be
 * able to act like a hand-minted full-scope token, and revoking one surface
 * must not silently disable the other. `apiTokenId` links to the hashed row so
 * the existing request middleware keeps working unchanged.
 *
 * One row is one authorization grant. Refreshing rotates the row: the old
 * access token row is deleted and the refresh hash replaced, so a replayed
 * refresh token stops working.
 */
export const oauthTokens = sqliteTable('oauth_tokens', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  apiTokenId: text('api_token_id').notNull().references(() => apiTokens.id, { onDelete: 'cascade' }),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
  accessExpiresAt: integer('access_expires_at', { mode: 'timestamp' }).notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  refreshExpiresAt: integer('refresh_expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

/**
 * Pending device authorizations (RFC 8628).
 *
 * This exists so a client on a headless machine — an SSH session, a container,
 * a cron job — can sign in without a loopback callback. The client receives a
 * short `user_code`, prints it, and polls the token endpoint; the owner types
 * that code on a page they open on whatever machine has a browser.
 *
 * `id` is the SHA-256 of the `device_code`, so a leaked database row cannot be
 * polled with. `userId` stays null until the owner approves, which is what
 * separates "issued" from "granted".
 */
export const oauthDeviceCodes = sqliteTable('oauth_device_codes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  /** Short human-typed code, normalized to uppercase without separators. */
  userCode: text('user_code').notNull().unique(),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
  resource: text('resource'),
  /** Set when the owner approves or denies; null while pending. */
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  deniedAt: integer('denied_at', { mode: 'timestamp' }),
  /** Set once the client has exchanged the device code; makes it single-use. */
  consumedAt: integer('consumed_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})


export const apiTokens = sqliteTable('api_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references(() => folders.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  type: text('type', { enum: ['markdown', 'html', 'javascript', 'pdf', 'image', 'json', 'bundle'] }).notNull(),
  visibility: text('visibility', { enum: ['private', 'public', 'unlisted'] }).notNull().default('private'),
  contentPath: text('content_path').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

export const artifactVersions = sqliteTable('artifact_versions', {
  id: text('id').primaryKey(),
  artifactId: text('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  contentPath: text('content_path').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>().default({}),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type ApiToken = typeof apiTokens.$inferSelect
export type NewApiToken = typeof apiTokens.$inferInsert
export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Artifact = typeof artifacts.$inferSelect
export type NewArtifact = typeof artifacts.$inferInsert
export type ArtifactVersion = typeof artifactVersions.$inferSelect
export type NewArtifactVersion = typeof artifactVersions.$inferInsert
