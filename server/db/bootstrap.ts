/**
 * Schema bootstrap shared by local SQLite, Turso/libSQL and Cloudflare D1.
 *
 * Keeping the statements in one place means a new table cannot be added to one
 * runtime and forgotten in the other.
 */
export const BOOTSTRAP_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes TEXT NOT NULL DEFAULT '[]',
    last_used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`,
  `CREATE TABLE IF NOT EXISTS rangka (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    content_path TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(user_id, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS rangka_versions (
    id TEXT PRIMARY KEY NOT NULL,
    rangka_id TEXT NOT NULL REFERENCES rangka(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content_path TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    stored_bytes INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(rangka_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS rangka_data (
    rangka_id TEXT NOT NULL REFERENCES rangka(id) ON DELETE CASCADE,
    collection TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    data TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    updated_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (rangka_id, collection, doc_id)
  )`,
  `CREATE TABLE IF NOT EXISTS workspace_settings (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_limit_bytes INTEGER,
    storage_mode TEXT NOT NULL DEFAULT 'warn',
    keep_versions INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`,
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
    label TEXT,
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
    label TEXT,
    label_set_by TEXT,
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
    label TEXT,
    approved_at INTEGER,
    denied_at INTEGER,
    consumed_at INTEGER,
    api_token_id TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`,
]

export const BOOTSTRAP_SQL = BOOTSTRAP_STATEMENTS.map(statement => `${statement};`).join('\n')
