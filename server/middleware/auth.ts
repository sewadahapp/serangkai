import { getCookie } from 'h3'
import { verifySessionToken, hashToken } from '../utils/auth'
import { users, apiTokens } from '../db/schema'
import { getRequestDatabase } from '../db/adapter'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  // Skip for auth routes that don't need auth
  const path = event.path
  if (path.startsWith('/api/auth/register') || path.startsWith('/api/auth/login')) {
    return
  }

  // Check session cookie
  const sessionCookie = getCookie(event, 'session')
  if (sessionCookie) {
    const verified = await verifySessionToken(sessionCookie)
    if (verified) {
      const user = await db.select().from(users).where(eq(users.id, verified.userId)).get()
      if (user) {
        event.context.user = user
        return
      }
    }
  }

  // Check API token
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const tokenHash = await hashToken(token)
    const apiToken = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash)).get()
    if (apiToken) {
      // Check expiration
      if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
        return
      }
      const user = await db.select().from(users).where(eq(users.id, apiToken.userId)).get()
      if (user) {
        event.context.user = user
        event.context.apiToken = apiToken
        // Update last used
        await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, apiToken.id))
        return
      }
    }
  }

  // For API routes that require auth, we'll handle in route handlers
  // For now, just attach if available
})
