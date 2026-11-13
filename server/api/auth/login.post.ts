import { users } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { generateToken } from '../../utils/auth'
import { clientBucketKey, createRateLimiter } from '../../utils/rate-limit'
import { readLoginDevice, rememberLoginDevice } from '../../utils/login-device'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

function positiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/**
 * Owner-login brute-force protection.
 *
 * Per process, like the OAuth limiters: it makes a naive online guessing attack
 * expensive on Node/Docker, while a distributed deployment needs a durable
 * counter. The window is deliberately long and the limit low; successful login
 * clears the bucket so a person who mistyped once is not locked out later.
 */
const loginLimiter = createRateLimiter({
  limit: positiveInt('SERANGKAI_LOGIN_RATE_LIMIT', 10),
  windowMs: positiveInt('SERANGKAI_LOGIN_RATE_WINDOW_MS', 15 * 60 * 1000),
})

// Same limits, separate buckets: a browser that signed in before is throttled
// per device, so failures on the shared address bucket cannot lock it out.
const deviceLimiter = createRateLimiter({
  limit: positiveInt('SERANGKAI_LOGIN_RATE_LIMIT', 10),
  windowMs: positiveInt('SERANGKAI_LOGIN_RATE_WINDOW_MS', 15 * 60 * 1000),
})

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(1024),
  // Optional same-origin path to return to after a native form post.
  redirect: z.string().max(2048).optional(),
})

// One scrypt hash reused for unknown usernames, so a missing account costs the
// same as a wrong password. Lazily created: most instances never see a miss.
let dummyPasswordHash: Promise<string> | undefined

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const contentType = getRequestHeader(event, 'content-type') || ''
  // A plain HTML form submits urlencoded data. That path is used when the
  // browser submits the login form before Nuxt has hydrated it, so respond
  // with redirects instead of JSON errors.
  const isFormPost = contentType.startsWith('application/x-www-form-urlencoded')

  const device = readLoginDevice(event)
  const limiter = device ? deviceLimiter : loginLimiter
  const bucket = device || clientBucketKey(event)
  const attempt = limiter.hit(bucket)
  if (attempt.limited) {
    setHeader(event, 'Retry-After', String(attempt.retryAfterSeconds))
    if (isFormPost) return sendRedirect(event, '/auth/login?error=invalid', 303)
    throw createError({ statusCode: 429, message: 'Too many login attempts. Try again later.' })
  }

  const fail = (statusCode: number, message: string) => {
    if (isFormPost) return sendRedirect(event, '/auth/login?error=invalid', 303)
    throw createError({ statusCode, message })
  }

  const result = schema.safeParse(await readBody(event))

  if (!result.success) {
    return fail(400, 'Invalid input')
  }

  const username = result.data.username.toLowerCase()
  const user = await db.select().from(users).where(eq(users.username, username)).get()

  let valid = false
  try {
    if (user) {
      valid = await verifyPassword(user.passwordHash, result.data.password)
    } else {
      dummyPasswordHash ||= hashPassword(generateToken())
      await verifyPassword(await dummyPasswordHash, result.data.password)
    }
  } catch {
    valid = false
  }
  if (!user || !valid) {
    return fail(401, 'Invalid credentials')
  }

  const sessionUser = { id: user.id, username: user.username || username }
  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: new Date(),
  })
  // A successful sign-in clears the window so the owner is not punished for
  // earlier typos or for a shared NAT address.
  limiter.reset(bucket)
  rememberLoginDevice(event, device)

  if (isFormPost) {
    // Only a same-origin absolute path is honored, so the login form cannot be
    // used as an open redirect.
    const target = String(result.data.redirect || '')
    const safe = target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')
      ? target
      : '/'
    return sendRedirect(event, safe, 303)
  }

  return { user: sessionUser, message: 'Logged in successfully' }
})
