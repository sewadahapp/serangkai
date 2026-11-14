import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'
import { BOOTSTRAP_SQL } from './bootstrap'
import { ensureGlobalSlugUniqueness, ensureOAuthSchema, ensureUserSchema, ensureRangkaSchema, recoverEmptyRangkaTables } from './migrations'
import { getServerConfig } from '../utils/config'

/**
 * Local SQLite database, created lazily.
 *
 * Bun's built-in SQLite is used when the app runs under Bun; Node keeps the
 * better-sqlite3 fallback. Both produce the same SQLite file, so existing data
 * and Drizzle queries are unchanged.
 */
let databasePromise: Promise<any> | null = null

async function createDatabase() {
  const path = getServerConfig().databasePath
  mkdirSync(dirname(path), { recursive: true })

  if ((process.versions as any).bun) {
    const { Database } = await import('bun:sqlite')
    const { drizzle } = await import('drizzle-orm/bun-sqlite')
    const sqlite = new Database(path)
    sqlite.exec('PRAGMA foreign_keys = ON;')
    recoverEmptyRangkaTables(sqlite)
    const db = drizzle(sqlite, { schema })
    await ensureRangkaSchema(db)
    sqlite.exec(BOOTSTRAP_SQL)
    await ensureUserSchema(db)
    await ensureGlobalSlugUniqueness(db)
    await ensureOAuthSchema(db)
    return db
  }

  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  recoverEmptyRangkaTables(sqlite)
  const db = drizzle(sqlite, { schema })
  await ensureRangkaSchema(db)
  sqlite.exec(BOOTSTRAP_SQL)
  await ensureUserSchema(db)
  await ensureGlobalSlugUniqueness(db)
  await ensureOAuthSchema(db)
  return db
}

export function getDatabase() {
  databasePromise ||= createDatabase()
  return databasePromise
}
