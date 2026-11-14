import { sql } from 'drizzle-orm'

/**
 * An interrupted development reload can bootstrap the new SQLite tables before
 * the rename runs. Recheck their emptiness under a write lock before removing
 * these unused duplicates. Populated tables always remain for manual recovery.
 * Both local SQLite drivers expose this synchronous transaction interface.
 */
export function recoverEmptyRangkaTables(sqlite: {
  prepare: (query: string) => { all: () => any[]; get: () => any }
  exec: (query: string) => unknown
  transaction: (callback: () => void) => { immediate: () => void }
}) {
  sqlite.transaction(() => {
    const names = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name))
    const parentConflict = names.has('artifacts') && names.has('rangka')
    const versionConflict = names.has('artifact_versions') && names.has('rangka_versions')
    if (!parentConflict && !versionConflict) return

    // Check both tables before touching either: dropping an empty parent could
    // otherwise cascade into version rows in an inconsistent legacy database.
    for (const name of ['rangka', 'rangka_versions']) {
      if (names.has(name) && sqlite.prepare(`SELECT 1 FROM ${name} LIMIT 1`).get()) return
    }
    if (names.has('rangka_versions')) sqlite.exec('DROP TABLE rangka_versions')
    if (parentConflict) sqlite.exec('DROP TABLE rangka')
  }).immediate()
}

/** Rename the pre-Rangka schema in place, retaining IDs, slugs and file keys. */
export async function ensureRangkaSchema(db: any) {
  const tables = async () => new Set((await db.all(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((row: any) => row.name))
  const rename = async (oldName: string, newName: string) => {
    const names = await tables()
    if (!names.has(oldName)) return
    if (names.has(newName)) throw new Error(`Cannot migrate ${oldName}: ${newName} already exists. Preserve both tables and resolve the conflicting database before starting.`)
    try { await db.run(sql.raw(`ALTER TABLE ${oldName} RENAME TO ${newName}`)) }
    catch (error) {
      // Another D1 isolate may have completed exactly this step.
      const current = await tables()
      if (current.has(oldName) || !current.has(newName)) throw error
    }
  }
  await rename('artifacts', 'rangka')
  await rename('artifact_versions', 'rangka_versions')
  if ((await tables()).has('rangka_versions')) {
    const columns = await db.all(sql`PRAGMA table_info(rangka_versions)`)
    if (columns.some((column: any) => column.name === 'artifact_id')) {
      try { await db.run(sql`ALTER TABLE rangka_versions RENAME COLUMN artifact_id TO rangka_id`) }
      catch (error) {
        const current = await db.all(sql`PRAGMA table_info(rangka_versions)`)
        if (!current.some((column: any) => column.name === 'rangka_id')) throw error
      }
    }
  }
  await db.run(sql`DROP INDEX IF EXISTS artifacts_slug_unique`)
}

/**
 * Global uniqueness for public share identifiers.
 *
 * Rangka are resolved by slug alone (`/api/share/:slug`), but the original
 * schema only enforced `UNIQUE(user_id, slug)`. Two users could therefore own
 * the same slug, and the share route would resolve whichever row the database
 * happened to return first: one user's link could open another user's rangka
 * (or a private 403) instead of their own.
 *
 * This migration makes the invariant global. Existing duplicates are
 * disambiguated deterministically: the oldest rangka keeps its slug (so the
 * longest-lived share URL keeps working), and later ones get a short suffix.
 */
export async function ensureGlobalSlugUniqueness(db: any) {
  try {
    await ensureGlobalSlugUniquenessOnce(db)
  } catch (error) {
    // Two Cloudflare isolates can run this migration at the same time. One may
    // lose the race while the other is still rewriting duplicate slugs; retry
    // once so the winner's work is visible and the index can be created.
    if (!/SQLITE_BUSY|database is locked|unique constraint failed.*rangka_slug_unique|rangka_slug_unique/i.test(errorText(error))) {
      throw error
    }
    await ensureGlobalSlugUniquenessOnce(db)
  }
}

async function ensureGlobalSlugUniquenessOnce(db: any) {
  const existingIndex = await db.all<{ name: string }>(sql`
    SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'rangka_slug_unique'
  `)
  if (existingIndex.length) return

  const duplicates = await db.all<{ slug: string }>(sql`
    SELECT slug FROM rangka GROUP BY slug HAVING COUNT(*) > 1
  `)

  for (const row of duplicates) {
    const slug = row?.slug
    if (!slug) continue
    const owners = await db.all<{ id: string; userId: string }>(sql`
      SELECT id, user_id AS userId FROM rangka
      WHERE slug = ${slug}
      ORDER BY created_at ASC, id ASC
    `)
    for (const rangka of owners.slice(1)) {
      const base = `${slug}-${String(rangka.id).slice(0, 6)}`
      let candidate = base
      let attempt = 0
      // The suffix is derived from the id, so a collision is unlikely but the
      // loop keeps the invariant absolute rather than probabilistic.
      while (true) {
        const taken = await db.all<{ id: string }>(sql`
          SELECT id FROM rangka WHERE slug = ${candidate} LIMIT 1
        `)
        if (!taken.length) break
        candidate = `${base}-${++attempt}`
      }
      await db.run(sql`UPDATE rangka SET slug = ${candidate} WHERE id = ${rangka.id}`)
      console.warn(`[serangkai] Reassigned duplicate rangka slug "${slug}" -> "${candidate}" (rangka ${rangka.id}).`)
    }
  }

  // A partial index would let duplicates slip back in; this is the durable
  // guarantee that two rangka can never share a public identifier.
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS rangka_slug_unique ON rangka (slug)`)
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
  return /unique constraint failed.*rangka\.slug/i.test(message)
    || /UNIQUE constraint failed: rangka\.slug/i.test(message)
    || /rangka_slug_unique/i.test(message)
}

/** True when a unique-constraint error came from `UNIQUE(rangka_id, version)`. */
export function isVersionConflict(error: any) {
  return /unique constraint failed.*rangka_versions\.(rangka_id|version)/i.test(errorText(error))
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
      resource TEXT,
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
      api_token_id TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE INDEX IF NOT EXISTS oauth_codes_expires_idx ON oauth_codes (expires_at)`,
    `CREATE INDEX IF NOT EXISTS oauth_tokens_client_idx ON oauth_tokens (client_id)`,
    `CREATE INDEX IF NOT EXISTS oauth_tokens_api_token_idx ON oauth_tokens (api_token_id)`,
  ]
  for (const statement of statements) await db.run(sql.raw(statement))

  // RFC 8707 audience binding was added after OAuth shipped. Existing grants
  // keep working: they are bound on first refresh or first MCP request.
  let hasResource = false
  try {
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(oauth_tokens)`)
    hasResource = columns.some(column => String(column.name) === 'resource')
  } catch {
    // Some edge runtimes restrict PRAGMA; fall through to a guarded ALTER.
  }
  if (!hasResource) {
    try {
      await db.run(sql`ALTER TABLE oauth_tokens ADD COLUMN resource TEXT`)
    } catch (error) {
      if (!/duplicate column|already exists/i.test(errorText(error))) throw error
    }
  }

  // Atomic device-code redemption links the winning API token to the device
  // row. Additive and nullable: existing pending codes keep working.
  let hasDeviceApiTokenId = false
  try {
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(oauth_device_codes)`)
    hasDeviceApiTokenId = columns.some(column => String(column.name) === 'api_token_id')
  } catch {
    // Some edge runtimes restrict PRAGMA; fall through to a guarded ALTER.
  }
  if (!hasDeviceApiTokenId) {
    try {
      await db.run(sql`ALTER TABLE oauth_device_codes ADD COLUMN api_token_id TEXT`)
    } catch (error) {
      if (!/duplicate column|already exists/i.test(errorText(error))) throw error
    }
  }
}
