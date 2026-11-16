export type DatabaseProvider = 'sqlite' | 'd1' | 'turso'

export function getDatabaseProvider(env: NodeJS.ProcessEnv = process.env): DatabaseProvider {
  const driver = env.DATABASE_DRIVER || 'sqlite'
  if (driver === 'sqlite' || driver === 'd1' || driver === 'turso') return driver
  throw new Error('Unknown DATABASE_DRIVER. Use sqlite, d1, or turso.')
}

export function getTursoConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = env.TURSO_DATABASE_URL || ''
  if (!url) throw new Error('TURSO_DATABASE_URL is required when DATABASE_DRIVER=turso.')
  let parsed: URL
  try { parsed = new URL(url) }
  catch { throw new Error('TURSO_DATABASE_URL must be a valid libsql://, https://, or http:// URL.') }
  if (!['libsql:', 'https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('TURSO_DATABASE_URL must be a libsql://, https://, or http:// URL without embedded credentials.')
  }
  // Self-hosted libSQL may run without authentication. Turso Cloud requires
  // an auth token; its server rejects requests when the token is missing.
  return { url, authToken: env.TURSO_AUTH_TOKEN || undefined }
}
