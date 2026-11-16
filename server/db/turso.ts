import { createClient, type Client } from '@libsql/client/web'
import { drizzle } from 'drizzle-orm/libsql/web'
import * as schema from './schema'
import { BOOTSTRAP_STATEMENTS } from './bootstrap'
import { ensureGlobalSlugUniqueness, ensureOAuthSchema, ensureUserSchema, ensureRangkaSchema } from './migrations'
import { getServerConfig } from '../utils/config'

/** Use the network-only client so Node, Bun and Workers need no native libSQL binary. */
export async function createTursoDatabase(client: Client) {
  const db = drizzle(client, { schema })
  // Rename legacy tables before bootstrap can create conflicting empty ones.
  // Populated conflicts are deliberately preserved for manual recovery.
  await ensureRangkaSchema(db)
  await client.batch(BOOTSTRAP_STATEMENTS, 'write')
  await ensureUserSchema(db)
  await ensureGlobalSlugUniqueness(db)
  await ensureOAuthSchema(db)
  return db
}

let databasePromise: ReturnType<typeof createTursoDatabase> | undefined

export function getTursoDatabase() {
  databasePromise ||= (async () => {
    const config = getServerConfig().turso
    if (!config) throw new Error('Turso requires DATABASE_DRIVER=turso.')
    const client = createClient(config)
    try {
      return await createTursoDatabase(client)
    } catch (error) {
      client.close()
      throw error
    }
  })().catch((error) => {
    // Concurrent requests wait for initialization; transient failures can retry.
    databasePromise = undefined
    throw error
  })
  return databasePromise
}
