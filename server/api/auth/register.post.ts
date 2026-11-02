import { nanoid } from 'nanoid'
import { db, users } from '../../db'
import { hashPassword, createSessionToken } from '../../utils/auth'
import { setCookie } from 'h3'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Invalid input' })
  }
  
  const { email, password } = result.data
  
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email)).get()
  if (existing) {
    throw createError({ statusCode: 400, message: 'User already exists' })
  }
  
  const userId = nanoid()
  const passwordHash = await hashPassword(password)
  
  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  const token = createSessionToken(userId)
  setCookie(event, 'session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  
  return { user: { id: userId, email }, message: 'Registered successfully' }
})
