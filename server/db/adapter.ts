import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import * as schema from './schema'

export type DatabaseProvider = 'sqlite' | 'd1'

export interface D1Like {
  prepare(query: string): { run(): Promise<unknown> }
  batch?(statements: Array<{ run(): Promise<unknown> }>): Promise<unknown[]>
}

export function getDatabaseProvider(env: NodeJS.ProcessEnv = process.env): DatabaseProvider {
  return env.DATABASE_DRIVER === 'd1' ? 'd1' : 'sqlite'
}

/** Create a Drizzle D1 database from a request-scoped Cloudflare binding. */
export function createD1Database(client: D1Like) {
  return drizzleD1(client as any, { schema })
}

/** Resolve the database for the current request. Node uses the local SQLite
 * singleton; Cloudflare Workers uses the request-scoped D1 binding. */
export async function getRequestDatabase(event: any) {
  const cloudflare = event?.req?.runtime?.cloudflare
  const binding = cloudflare?.env?.DB
  if (binding) {
    if (!event.context.d1Database) {
      event.context.d1Database = createD1Database(binding)
      await initializeD1Schema(binding)
    }
    return event.context.d1Database
  }
  const { db } = await import('#serangkai-db-runtime')
  return db
}

/** Apply the small bootstrap schema for development/preview D1 databases.
 * Production deployments should use generated Drizzle migrations instead. */
export async function initializeD1Schema(client: D1Like) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')))`,
    `CREATE TABLE IF NOT EXISTS api_tokens (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL DEFAULT '[]', last_used_at INTEGER, expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')))`,
    `CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE, name TEXT NOT NULL, path TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')))` ,
    `CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL, slug TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', content_path TEXT NOT NULL, metadata TEXT DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE(user_id, slug))`,
    `CREATE TABLE IF NOT EXISTS artifact_versions (id TEXT PRIMARY KEY NOT NULL, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE, version INTEGER NOT NULL, content_path TEXT NOT NULL, metadata TEXT DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE(artifact_id, version))`,
  ].map(statement => client.prepare(statement))
  if (client.batch) return client.batch(statements)
  for (const statement of statements) await statement.run()
}
