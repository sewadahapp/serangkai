import { users, apiTokens } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { ensureOwnerAccount } from '../utils/owner'
import { hashToken } from '../utils/auth'
import { eq } from 'drizzle-orm'

// Static assets and the auth module's own session route do not need the owner
// bootstrap or a database round-trip on every request.
const staticPrefixes = ['/_nuxt', '/__nuxt', '/fonts/', '/runtime/', '/artifact-themes/']
const SESSION_ROUTE = '/api/_auth/session'

function isStatic(path: string) {
  return staticPrefixes.some(prefix => path.startsWith(prefix))
}

export default defineEventHandler(async (event) => {
  const path = event.path
  if (isStatic(path)) return

  const db = await getRequestDatabase(event)

  // Create/adopt/rotate the single owner before any request that may read it.
  // The work is cached per process/isolate; a failure stays visible instead of
  // starting an account-less server.
  await ensureOwnerAccount(db)

  // A request that explicitly presents a bearer token is an agent request. Do
  // not let a browser cookie authorize it as a fallback: an invalid/expired
  // token must fail, not silently inherit the owner's session.
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const tokenHash = await hashToken(token)
    const apiToken = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).get()
    if (!apiToken) return
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) return

    const user = await db.select().from(users).where(eq(users.id, apiToken.userId)).get()
    // Accounts excluded by the owner migration keep their data but lose the
    // username, which makes their tokens inert.
    if (!user?.username) return

    event.context.user = user
    event.context.apiToken = apiToken
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, apiToken.id))
    return
  }

  if (path === SESSION_ROUTE) return

  // Nuxt Auth Utils owns the sealed session cookie.
  let session: Awaited<ReturnType<typeof getUserSession>> | undefined
  try {
    session = await getUserSession(event)
  } catch {
    return
  }
  const userId = session?.user?.id
  if (!userId) return

  const user = await db.select().from(users).where(eq(users.id, userId)).get()
  if (user?.username) event.context.user = user
})
