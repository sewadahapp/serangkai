import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm'
import { rangkaItems, rangkaVersions } from '../db/schema'
import { removeRangka } from './rangka-storage'
import { getStorageSettings } from './storage-quota'

/**
 * Deleting and pruning old versions.
 *
 * The current (newest) version is never deleted, so a rangka always keeps the
 * content it shows. Rows are deleted before files: a failed file delete leaves
 * an orphan on disk, never a version that points at missing bytes. A file is
 * only removed once no remaining version (and not the rangka itself) uses it.
 *
 * Work per request is capped because every removed file is one storage call,
 * and Cloudflare Workers limit how many calls a request may make. A larger
 * backlog shrinks over later requests instead of failing one.
 */

/** Most versions one manual "clear older versions" request removes. */
export const CLEAR_BATCH = 25
/** Most versions one save prunes when a retention setting applies. */
export const AUTO_PRUNE_BATCH = 10

type RangkaRow = typeof rangkaItems.$inferSelect
type VersionRow = { id: string; version: number; contentPath: string; storedBytes: number | null }

export interface PruneResult {
  deleted: number
  freedBytes: number
  /** Versions still past the retention point after this batch. */
  remaining: number
}

const versionFields = {
  id: rangkaVersions.id,
  version: rangkaVersions.version,
  contentPath: rangkaVersions.contentPath,
  storedBytes: rangkaVersions.storedBytes,
}

/**
 * A bundle's first version also accounts for the files unpacked next to it,
 * which keep serving the bundle. Deleting that row would drop those bytes from
 * the meter while they stay on disk, so it is kept.
 */
const isProtected = (rangka: RangkaRow, row: VersionRow) => rangka.type === 'bundle' && row.version === 1

export async function latestVersion(db: any, rangkaId: string): Promise<number | null> {
  const row = await db.select({ version: rangkaVersions.version }).from(rangkaVersions)
    .where(eq(rangkaVersions.rangkaId, rangkaId)).orderBy(desc(rangkaVersions.version)).limit(1).get()
  return row?.version ?? null
}

async function removeRows(db: any, rangka: RangkaRow, rows: VersionRow[]) {
  if (!rows.length) return { deleted: 0, freedBytes: 0 }
  await db.delete(rangkaVersions).where(and(
    eq(rangkaVersions.rangkaId, rangka.id),
    inArray(rangkaVersions.id, rows.map(row => row.id)),
  ))
  const stillUsed = await db.select({ contentPath: rangkaVersions.contentPath }).from(rangkaVersions)
    .where(eq(rangkaVersions.rangkaId, rangka.id))
  const keep = new Set<string>([rangka.contentPath, ...stillUsed.map((row: { contentPath: string }) => row.contentPath)])
  for (const contentPath of new Set(rows.map(row => row.contentPath))) {
    if (keep.has(contentPath)) continue
    try { await removeRangka(contentPath) } catch {}
  }
  return { deleted: rows.length, freedBytes: rows.reduce((sum, row) => sum + (row.storedBytes || 0), 0) }
}

export type DeleteVersionOutcome =
  | { ok: true; freedBytes: number }
  | { ok: false; reason: 'not_found' | 'current' | 'protected' }

/** Delete one version. The current version and a bundle's first version are refused. */
export async function deleteVersion(db: any, rangka: RangkaRow, version: number): Promise<DeleteVersionOutcome> {
  const row = await db.select(versionFields).from(rangkaVersions)
    .where(and(eq(rangkaVersions.rangkaId, rangka.id), eq(rangkaVersions.version, version))).get()
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.version === await latestVersion(db, rangka.id) || row.contentPath === rangka.contentPath) return { ok: false, reason: 'current' }
  if (isProtected(rangka, row)) return { ok: false, reason: 'protected' }
  const { freedBytes } = await removeRows(db, rangka, [row])
  return { ok: true, freedBytes }
}

/**
 * Delete the oldest versions so that only the newest `keep` remain, removing at
 * most `limit` in this call. `keep` is at least 1, so the current version stays.
 */
export async function pruneVersions(db: any, rangka: RangkaRow, keep: number, limit: number): Promise<PruneResult> {
  const keepCount = Math.max(1, Math.floor(keep))
  // The oldest version that survives; everything below it is past retention.
  const boundary = await db.select({ version: rangkaVersions.version }).from(rangkaVersions)
    .where(eq(rangkaVersions.rangkaId, rangka.id)).orderBy(desc(rangkaVersions.version))
    .limit(1).offset(keepCount - 1).get()
  if (!boundary) return { deleted: 0, freedBytes: 0, remaining: 0 }

  const candidates: VersionRow[] = await db.select(versionFields).from(rangkaVersions)
    .where(and(eq(rangkaVersions.rangkaId, rangka.id), lt(rangkaVersions.version, boundary.version)))
    .orderBy(asc(rangkaVersions.version))
  const deletable = candidates.filter(row => !isProtected(rangka, row) && row.contentPath !== rangka.contentPath)
  const batch = deletable.slice(0, limit)
  const { deleted, freedBytes } = await removeRows(db, rangka, batch)
  return { deleted, freedBytes, remaining: deletable.length - batch.length }
}

/**
 * Apply the owner's retention setting after a save. Never throws: a failed
 * prune must not fail the save that triggered it.
 */
export async function autoPruneVersions(db: any, userId: string, rangkaId: string): Promise<void> {
  try {
    const { keepVersions } = await getStorageSettings(db, userId)
    if (!keepVersions) return
    const rangka = await db.select().from(rangkaItems)
      .where(and(eq(rangkaItems.id, rangkaId), eq(rangkaItems.userId, userId))).get()
    if (!rangka) return
    await pruneVersions(db, rangka, keepVersions, AUTO_PRUNE_BATCH)
  } catch (error) {
    console.warn('[serangkai] Version pruning after save failed:', error instanceof Error ? error.message : error)
  }
}
