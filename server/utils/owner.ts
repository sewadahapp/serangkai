import { eq, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { users } from '../db/schema'
import { getServerConfig } from './config'

/**
 * Ensures the single owner account exists and matches the environment.
 *
 * - Existing single-user installs adopt that account (its id, rangka,
 *   folders, versions, and API tokens are preserved).
 * - An empty database creates one owner.
 * - A multi-user database is never merged automatically. Startup fails with
 *   instructions and an optional explicit `SERANGKAI_MIGRATION_OWNER_USER_ID`.
 * - Username/password changes rotate credentials without touching data.
 */
let ownerReady: Promise<void> | undefined

export function ensureOwnerAccount(db: any) {
  ownerReady ||= initializeOwner(db).catch((error) => {
    // Allow the next request to retry after an operator fixes the database or
    // environment; the failure itself is still surfaced to the caller.
    ownerReady = undefined
    throw error
  })
  return ownerReady
}

async function initializeOwner(db: any) {
  const config = getServerConfig()
  const rows = await db.select().from(users)

  let owner: typeof users.$inferSelect | undefined
  if (rows.length > 1) {
    if (config.ownerMigrationUserId) {
      owner = rows.find((row: any) => row.id === config.ownerMigrationUserId)
      if (!owner) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Owner migration failed',
          message: `SERANGKAI_MIGRATION_OWNER_USER_ID="${config.ownerMigrationUserId}" does not match any user in this database.`,
        })
      }
      // Explicit migration policy: the chosen account becomes the only one that
      // can authenticate. Other accounts keep every row they own, but their
      // username is cleared so sessions and tokens can no longer resolve them.
      await db.update(users).set({ username: null }).where(ne(users.id, owner.id))
    } else {
      // An already-migrated database keeps the disabled accounts (no data is
      // deleted). Exactly one account has a username; adopt it without asking
      // for the migration variable on every restart.
      const active = rows.filter((row: any) => row.username)
      if (active.length !== 1) {
        const ids = rows.map((row: any) => row.id).join(', ')
        throw createError({
          statusCode: 500,
          statusMessage: 'Owner migration required',
          message: `This database contains ${rows.length} users, so Serangkai cannot choose a single owner automatically. `
            + `Set SERANGKAI_MIGRATION_OWNER_USER_ID to one of these ids, restart, and the other accounts will be left untouched: ${ids}`,
        })
      }
      owner = active[0]
    }
  } else if (rows.length === 1) {
    owner = rows[0]
  } else {
    owner = await createOwner(db, config)
  }

  await adoptOwner(db, owner, config)
}

async function createOwner(db: any, config: ReturnType<typeof getServerConfig>) {
  const username = config.adminUsername.toLowerCase()
  const passwordHash = await hashPassword(config.adminPassword)
  const now = new Date()
  const id = nanoid()

  try {
    await db.insert(users).values({
      id,
      email: `${username}@owner.local`,
      username,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    return { id, username, email: `${username}@owner.local`, passwordHash }
  } catch (error) {
    // A concurrent first request may have created the owner between the read
    // and the insert. Reuse it instead of failing.
    const existing = await db.select().from(users).where(eq(users.username, username)).get()
    if (existing) return existing
    throw error
  }
}

async function adoptOwner(db: any, owner: typeof users.$inferSelect, config: ReturnType<typeof getServerConfig>) {
  const username = config.adminUsername.toLowerCase()
  const changes: Record<string, unknown> = {}

  if (owner.username !== username) changes.username = username

  let passwordMatches = false
  try {
    passwordMatches = await verifyPassword(owner.passwordHash, config.adminPassword)
  } catch {
    // Legacy bcrypt hashes (from before this migration) are replaced below.
    passwordMatches = false
  }
  if (!passwordMatches) changes.passwordHash = await hashPassword(config.adminPassword)

  if (!Object.keys(changes).length) return
  changes.updatedAt = new Date()

  try {
    await db.update(users).set(changes).where(eq(users.id, owner.id))
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Owner migration failed',
      message: `Could not apply the configured owner credentials to user ${owner.id}. `
        + `Another account may already use the username "${username}". Choose a different ADMIN_USERNAME.`,
    })
  }
}
