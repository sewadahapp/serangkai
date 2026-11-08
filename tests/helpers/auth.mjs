import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

/**
 * Credentials used by integration tests. Production deployments set these
 * through ADMIN_USERNAME / ADMIN_PASSWORD instead.
 */
export const adminUsername = 'owner'
export const adminPassword = 'correct horse battery'

export function adminEnv() {
  return {
    ADMIN_USERNAME: adminUsername,
    ADMIN_PASSWORD: adminPassword,
  }
}

export async function login(base, username = adminUsername, password = adminPassword) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) {
    throw new Error(`Login failed (${response.status}): ${await response.text()}`)
  }
  return { cookie: response.headers.get('set-cookie'), user: (await response.json()).user }
}

/** Creates an additional account directly for cross-owner isolation tests. */
export async function seedUser(databasePath, { id, username, password = adminPassword }) {
  const { Database } = await import('bun:sqlite')
  const sqlite = new Database(databasePath)
  try {
    const passwordHash = await new Hash(new Scrypt()).make(password)
    const now = Math.floor(Date.now() / 1000)
    sqlite.prepare(`
      INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, `${username}@owner.local`, username, passwordHash, now, now)
    return { id, username, password }
  } finally {
    sqlite.close()
  }
}
