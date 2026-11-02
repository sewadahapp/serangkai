import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const TOKEN_SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, TOKEN_SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return nanoid(32)
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(JWT_SECRET))
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload: decoded } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET))
    if (decoded.type === 'session') {
      return { userId: String(decoded.userId) }
    }
    return null
  } catch {
    return null
  }
}
