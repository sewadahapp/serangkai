import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_PATH || './data/serangkai.db'
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })
export * from './schema'
