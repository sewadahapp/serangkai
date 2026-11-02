import { users } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { verifyPassword, createSessionToken } from '../../utils/auth'
import { setCookie } from 'h3'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { email, password } = result.data
  
  const user = await db.select().from(users).where(eq(users.email, email)).get()
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }
  
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }
  
  const token = await createSessionToken(user.id)
  setCookie(event, 'session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  
  return { user: { id: user.id, email: user.email }, message: 'Logged in successfully' }
})
