import { and, eq } from 'drizzle-orm'
import { artifacts } from '../../../db/schema'
import { getRequestDatabase } from '../../../db/adapter'
import { requireUser } from '../../../utils/require-auth'
import { isValidShareKey } from '../../../utils/share'
import { bundleMimeType } from '../../../utils/bundles'
import { promises as fs } from 'node:fs'
import { join, normalize, relative } from 'node:path'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const slug = getRouterParam(event, 'slug')
  const path = getRouterParam(event, 'path') || 'index.html'
  const artifact = await db.select().from(artifacts).where(and(eq(artifacts.slug, slug || ''), eq(artifacts.type, 'bundle'))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Bundle not found' })
  const key = String(getQuery(event).k || '')
  if (artifact.visibility === 'private') { requireUser(event); if (event.context.user.id !== artifact.userId) throw createError({ statusCode: 403, message: 'Forbidden' }) }
  if (artifact.visibility === 'unlisted' && !isValidShareKey(artifact.id, key)) throw createError({ statusCode: 404, message: 'Bundle not found' })
  if (path.includes('\0') || path.startsWith('/') || path.split('/').includes('..')) throw createError({ statusCode: 404, message: 'File not found' })
  const root = `${process.env.STORAGE_PATH || './data/files'}/${artifact.userId}/${artifact.id}/bundle`
  const filePath = join(root, normalize(path))
  if (relative(root, filePath).startsWith('..')) throw createError({ statusCode: 404, message: 'File not found' })
  try {
    const content = await fs.readFile(filePath)
    setHeader(event, 'Content-Type', bundleMimeType(path))
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    if (path.endsWith('.html') || path === 'index.html') setHeader(event, 'Content-Security-Policy', "sandbox allow-scripts; default-src 'self'; connect-src 'none'; frame-ancestors 'none'; form-action 'none'")
    return content
  } catch { throw createError({ statusCode: 404, message: 'File not found' }) }
})
