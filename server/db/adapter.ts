import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import * as schema from './schema'
import { BOOTSTRAP_STATEMENTS } from './bootstrap'
import { ensureGlobalSlugUniqueness, ensureOAuthSchema, ensureUserSchema } from './migrations'

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

// Migrations must run once per isolate, not once per request. A boolean flag
// was a race: the second request saw `true` while the first was still running
// and queried a half-created schema. The shared promise makes every concurrent
// request wait for the same work, and a failure clears it so the next request
// retries instead of permanently serving an uninitialized database.
let d1Initialization: Promise<void> | null = null

/** Test hook: each adapter test needs a fresh per-isolate initialization. */
export function resetD1InitializationForTests() {
  d1Initialization = null
}

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
    }
    const db = event.context.d1Database

    if (!d1Initialization) {
      const initialization = (async () => {
        await initializeD1Schema(binding)
        await ensureUserSchema(db)
        await ensureGlobalSlugUniqueness(db)
        await ensureOAuthSchema(db)
      })()
      d1Initialization = initialization
      // Do not leave a rejected promise cached forever: a transient D1 error
      // should be retried by the next request.
      initialization.catch(() => {
        if (d1Initialization === initialization) d1Initialization = null
      })
    }

    await d1Initialization
    return db
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
