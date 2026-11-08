import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import * as schema from './schema'
import { BOOTSTRAP_STATEMENTS } from './bootstrap'
import { ensureGlobalSlugUniqueness } from './migrations'

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

// Migrations must run once per isolate, not once per request. D1 has no
// connection-level state to hold the flag, so it lives at module scope.
let d1Migrated = false

/**
 * Resolve the database for the current request.
 *
 * Cloudflare exposes its bindings on `event.context.cloudflare`; every other
 * runtime uses the lazy local SQLite singleton. Nitro 2's experimental db0
 * layer is intentionally not used because Drizzle already owns the schema and
 * query surface.
 */
export async function getRequestDatabase(event: any) {
  const binding = event?.context?.cloudflare?.env?.DB
  if (binding) {
    if (!event.context.d1Database) {
      event.context.d1Database = createD1Database(binding)
      await initializeD1Schema(binding)
      if (!d1Migrated) {
        d1Migrated = true
        await ensureGlobalSlugUniqueness(event.context.d1Database)
      }
    }
    return event.context.d1Database
  }

  const { getDatabase } = await import('#serangkai-db-runtime')
  return getDatabase()
}

/** Apply the shared bootstrap schema to development/preview D1 databases. */
export async function initializeD1Schema(client: D1Like) {
  const statements = BOOTSTRAP_STATEMENTS.map(statement => client.prepare(statement))
  if (client.batch) return client.batch(statements)
  for (const statement of statements) await statement.run()
}
