import { users } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(1024),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const contentType = getRequestHeader(event, 'content-type') || ''
  // A plain HTML form submits urlencoded data. That path is used when the
  // browser submits the login form before Nuxt has hydrated it, so respond
  // with redirects instead of JSON errors.
  const isFormPost = contentType.startsWith('application/x-www-form-urlencoded')

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
  if (!user) {
    return fail(401, 'Invalid credentials')
  }

  let valid = false
  try {
    valid = await verifyPassword(user.passwordHash, result.data.password)
  } catch {
    valid = false
  }
  if (!valid) {
    return fail(401, 'Invalid credentials')
  }

  const sessionUser = { id: user.id, username: user.username || username }
  await setUserSession(event, {
    user: sessionUser,
    loggedInAt: new Date(),
  })

  if (isFormPost) {
    return sendRedirect(event, '/workspace', 303)
  }

  return { user: sessionUser, message: 'Logged in successfully' }
})
