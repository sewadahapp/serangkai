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
  const result = schema.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }

  const username = result.data.username.toLowerCase()
  const user = await db.select().from(users).where(eq(users.username, username)).get()
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  let valid = false
  try {
    valid = await verifyPassword(user.passwordHash, result.data.password)
  } catch {
    valid = false
  }
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: { id: user.id, username: user.username || username },
    loggedInAt: new Date(),
  })

  return { user: { id: user.id, username: user.username || username }, message: 'Logged in successfully' }
})
