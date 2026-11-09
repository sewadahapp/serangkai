import { sql } from 'drizzle-orm'

/**
 * Global uniqueness for public share identifiers.
 *
 * Artifacts are resolved by slug alone (`/api/share/:slug`), but the original
 * schema only enforced `UNIQUE(user_id, slug)`. Two users could therefore own
 * the same slug, and the share route would resolve whichever row the database
 * happened to return first: one user's link could open another user's artifact
 * (or a private 403) instead of their own.
 *
 * This migration makes the invariant global. Existing duplicates are
 * disambiguated deterministically: the oldest artifact keeps its slug (so the
 * longest-lived share URL keeps working), and later ones get a short suffix.
 */
export async function ensureGlobalSlugUniqueness(db: any) {
  const existingIndex = await db.all<{ name: string }>(sql`
    SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'artifacts_slug_unique'
  `)
  if (existingIndex.length) return

  const duplicates = await db.all<{ slug: string }>(sql`
    SELECT slug FROM artifacts GROUP BY slug HAVING COUNT(*) > 1
  `)

  for (const row of duplicates) {
    const slug = row?.slug
    if (!slug) continue
    const owners = await db.all<{ id: string; userId: string }>(sql`
      SELECT id, user_id AS userId FROM artifacts
      WHERE slug = ${slug}
      ORDER BY created_at ASC, id ASC
    `)
    for (const artifact of owners.slice(1)) {
      const base = `${slug}-${String(artifact.id).slice(0, 6)}`
      let candidate = base
      let attempt = 0
      // The suffix is derived from the id, so a collision is unlikely but the
      // loop keeps the invariant absolute rather than probabilistic.
      while (true) {
        const taken = await db.all<{ id: string }>(sql`
          SELECT id FROM artifacts WHERE slug = ${candidate} LIMIT 1
        `)
        if (!taken.length) break
        candidate = `${base}-${++attempt}`
      }
      await db.run(sql`UPDATE artifacts SET slug = ${candidate} WHERE id = ${artifact.id}`)
      console.warn(`[serangkai] Reassigned duplicate artifact slug "${slug}" -> "${candidate}" (artifact ${artifact.id}).`)
    }
  }

  // A partial index would let duplicates slip back in; this is the durable
  // guarantee that two artifacts can never share a public identifier.
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS artifacts_slug_unique ON artifacts (slug)`)
}

/** Flattens a Drizzle error and its causes into one searchable string. */
function errorText(error: any) {
  const parts: string[] = []
  let current = error
  for (let depth = 0; current && depth < 5; depth++) {
    parts.push(String(current.message || current))
    current = current.cause
  }
  return parts.join(' | ')
}

/** True when a unique-constraint error came from the slug index. */
export function isSlugConflict(error: any) {
  const message = errorText(error)
  return /unique constraint failed.*artifacts\.slug/i.test(message)
    || /UNIQUE constraint failed: artifacts\.slug/i.test(message)
    || /artifacts_slug_unique/i.test(message)
}

/**
 * Adds the single-owner username column to databases created before this
 * milestone. `ALTER TABLE` failures for an existing column are ignored, so the
 * function is safe to call from every isolate/process at startup.
 */
export async function ensureUserSchema(db: any) {
  let hasUsername = false
  try {
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(users)`)
    hasUsername = columns.some(column => String(column.name) === 'username')
  } catch {
    // Some edge runtimes restrict PRAGMA; fall through to a guarded ALTER.
  }

  if (!hasUsername) {
    try {
      await db.run(sql`ALTER TABLE users ADD COLUMN username TEXT`)
    } catch (error) {
      if (!/duplicate column|already exists/i.test(errorText(error))) throw error
    }
  }

  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)
    WHERE username IS NOT NULL
  `)
}

/**
 * Adds the OAuth tables to databases created before agent authorization.
 *
 * `CREATE TABLE IF NOT EXISTS` in the bootstrap only runs for a brand-new
 * database, so an existing installation would otherwise have no way to connect
 * an MCP client. These statements are idempotent and additive: no existing row
 * is read, moved, or deleted.
 */
export async function ensureOAuthSchema(db: any) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS oauth_clients (
      id TEXT PRIMARY KEY NOT NULL,
      client_name TEXT,
      client_uri TEXT,
      redirect_uris TEXT NOT NULL DEFAULT '[]',
      scopes TEXT NOT NULL DEFAULT '[]',
      token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
      client_secret_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_codes (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      resource TEXT,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      api_token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
      scopes TEXT NOT NULL DEFAULT '[]',
      access_expires_at INTEGER NOT NULL,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      refresh_expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_device_codes (
      id TEXT PRIMARY KEY NOT NULL,
      client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      user_code TEXT NOT NULL UNIQUE,
      scopes TEXT NOT NULL DEFAULT '[]',
      resource TEXT,
      approved_at INTEGER,
      denied_at INTEGER,
      consumed_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE INDEX IF NOT EXISTS oauth_codes_expires_idx ON oauth_codes (expires_at)`,
    `CREATE INDEX IF NOT EXISTS oauth_tokens_client_idx ON oauth_tokens (client_id)`,
  ]
  for (const statement of statements) await db.run(sql.raw(statement))
}
