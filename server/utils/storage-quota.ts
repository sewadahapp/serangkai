import { and, eq, isNull, sql } from 'drizzle-orm'
import { rangkaItems, rangkaVersions, workspaceSettings } from '../db/schema'
import { formatByteSize } from '../../shared/byte-size'
import { getServerConfig } from './config'
import { rangkaStorage } from './rangka-storage'

/**
 * Storage accounting and limits.
 *
 * Usage is the sum of `stored_bytes` over an account's versions: every write
 * path records the bytes it stored, and rows written before accounting existed
 * are measured once by the backfill below. Deleting a rangka removes its
 * version rows, so usage drops with it.
 *
 * Two limits apply:
 * - the owner limit (Settings), which follows the owner's mode: `warn` only
 *   reports, `reject` refuses writes that would exceed it;
 * - the operator cap (STORAGE_LIMIT), which is always enforced. The owner can
 *   set a lower limit but never a higher one, so a hosted plan stays a hard cap
 *   no matter what a client sends.
 *
 * Checks are not transactional: two writes racing at the edge of the limit can
 * both pass. That overshoot is bounded by one request's size, which is fine for
 * a soft quota; the operator cap is still checked on every later write.
 */

export type StorageMode = 'warn' | 'reject'

export interface StorageStatus {
  usedBytes: number
  /** The limit that applies right now: the lower of the owner limit and the operator cap. */
  limitBytes: number | null
  ownerLimitBytes: number | null
  operatorLimitBytes: number | null
  mode: StorageMode
  /** Local/Docker storage only: the real filesystem behind STORAGE_PATH. */
  disk: { totalBytes: number; freeBytes: number } | null
  /** True while older versions are still being measured, so usage may read low. */
  measuring: boolean
}

const BACKFILL_BATCH = 100

export const byteLength = (content: string | Buffer | Uint8Array) =>
  typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength

/** Size of one stored object, from driver metadata when available, else by reading it. */
async function objectSize(key: string): Promise<number> {
  const storage = rangkaStorage()
  try {
    const meta = await storage.getMeta(key) as { size?: unknown } | null
    const size = Number(meta?.size)
    if (Number.isFinite(size) && size >= 0) return size
  } catch {}
  try {
    const raw = await storage.getItemRaw(key)
    if (raw === null || raw === undefined) return 0
    return typeof raw === 'string' ? Buffer.byteLength(raw) : Buffer.from(raw as any).byteLength
  } catch {
    // A missing object occupies no space.
    return 0
  }
}

async function prefixSize(prefix: string): Promise<number> {
  let total = 0
  try {
    for (const key of await rangkaStorage().getKeys(prefix)) total += await objectSize(key)
  } catch {}
  return total
}

/**
 * Measures up to one batch of unmeasured versions for an account. Returns how
 * many rows are still unmeasured afterwards (0 once the backfill is done).
 */
export async function backfillStoredBytes(db: any, userId: string): Promise<number> {
  const rows = await db.select({
    id: rangkaVersions.id,
    version: rangkaVersions.version,
    contentPath: rangkaVersions.contentPath,
    rangkaId: rangkaItems.id,
    type: rangkaItems.type,
  }).from(rangkaVersions)
    .innerJoin(rangkaItems, eq(rangkaVersions.rangkaId, rangkaItems.id))
    .where(and(eq(rangkaItems.userId, userId), isNull(rangkaVersions.storedBytes)))
    .limit(BACKFILL_BATCH)
  if (!rows.length) return 0

  for (const row of rows) {
    let bytes = await objectSize(row.contentPath)
    // A bundle's first version also unpacked its files next to the archive.
    if (row.type === 'bundle' && row.version === 1) bytes += await prefixSize(`${userId}/${row.rangkaId}/bundle`)
    await db.update(rangkaVersions).set({ storedBytes: bytes }).where(eq(rangkaVersions.id, row.id))
  }
  return rows.length === BACKFILL_BATCH ? unmeasuredCount(db, userId) : 0
}

async function unmeasuredCount(db: any, userId: string): Promise<number> {
  const row = await db.select({ count: sql<number>`count(*)` }).from(rangkaVersions)
    .innerJoin(rangkaItems, eq(rangkaVersions.rangkaId, rangkaItems.id))
    .where(and(eq(rangkaItems.userId, userId), isNull(rangkaVersions.storedBytes))).get()
  return Number(row?.count || 0)
}

async function usedBytes(db: any, userId: string): Promise<number> {
  const row = await db.select({ used: sql<number>`coalesce(sum(${rangkaVersions.storedBytes}), 0)` })
    .from(rangkaVersions)
    .innerJoin(rangkaItems, eq(rangkaVersions.rangkaId, rangkaItems.id))
    .where(eq(rangkaItems.userId, userId)).get()
  return Number(row?.used || 0)
}

export async function getStorageSettings(db: any, userId: string): Promise<{ ownerLimitBytes: number | null; mode: StorageMode }> {
  const row = await db.select().from(workspaceSettings).where(eq(workspaceSettings.userId, userId)).get()
  return {
    ownerLimitBytes: row?.storageLimitBytes ?? null,
    mode: row?.storageMode === 'reject' ? 'reject' : 'warn',
  }
}

export async function saveStorageSettings(db: any, userId: string, settings: { ownerLimitBytes: number | null; mode: StorageMode }) {
  const values = { storageLimitBytes: settings.ownerLimitBytes, storageMode: settings.mode, updatedAt: new Date() }
  await db.insert(workspaceSettings).values({ userId, ...values })
    .onConflictDoUpdate({ target: workspaceSettings.userId, set: values })
}

/** Real filesystem size for local/Docker storage; null for object storage or edge runtimes. */
async function diskCapacity(): Promise<StorageStatus['disk']> {
  const config = getServerConfig()
  if (config.storageDriver !== 'local') return null
  try {
    const { statfs } = await import('node:fs/promises')
    const stats = await statfs(config.storagePath)
    return { totalBytes: stats.blocks * stats.bsize, freeBytes: stats.bavail * stats.bsize }
  } catch {
    return null
  }
}

const lowerOf = (...values: Array<number | null>) => {
  const set = values.filter((value): value is number => value !== null)
  return set.length ? Math.min(...set) : null
}

export async function getStorageStatus(db: any, userId: string, options: { disk?: boolean } = {}): Promise<StorageStatus> {
  // Measure older rows a batch at a time so a large legacy workspace never
  // stalls one request; the meter reports `measuring` until it is done.
  const remaining = await backfillStoredBytes(db, userId)
  const [used, settings, disk] = await Promise.all([
    usedBytes(db, userId),
    getStorageSettings(db, userId),
    options.disk === false ? Promise.resolve(null) : diskCapacity(),
  ])
  const operatorLimitBytes = getServerConfig().storageLimitBytes
  return {
    usedBytes: used,
    limitBytes: lowerOf(settings.ownerLimitBytes, operatorLimitBytes),
    ownerLimitBytes: settings.ownerLimitBytes,
    operatorLimitBytes,
    mode: settings.mode,
    disk,
    measuring: remaining > 0,
  }
}

/**
 * Returns why a write of `incomingBytes` must be refused, or null when it may
 * proceed. The operator cap always refuses; the owner limit refuses only in
 * `reject` mode.
 */
export async function storageWriteRefusal(db: any, userId: string, incomingBytes: number): Promise<string | null> {
  const status = await getStorageStatus(db, userId, { disk: false })
  const after = status.usedBytes + incomingBytes
  const left = (limit: number) => formatByteSize(Math.max(0, limit - status.usedBytes))
  if (status.operatorLimitBytes !== null && after > status.operatorLimitBytes) {
    return `Storage limit reached: this needs ${formatByteSize(incomingBytes)} but only ${left(status.operatorLimitBytes)} of this server's ${formatByteSize(status.operatorLimitBytes)} cap is left. Delete rangka to free space.`
  }
  if (status.mode === 'reject' && status.ownerLimitBytes !== null && after > status.ownerLimitBytes) {
    return `Storage limit reached: this needs ${formatByteSize(incomingBytes)} but only ${left(status.ownerLimitBytes)} of your ${formatByteSize(status.ownerLimitBytes)} limit is left. Delete rangka or raise the limit in Settings.`
  }
  return null
}

/** REST helper: throws 507 Insufficient Storage when the write must be refused. */
export async function assertStorageAvailable(db: any, userId: string, incomingBytes: number) {
  const refusal = await storageWriteRefusal(db, userId, incomingBytes)
  if (refusal) throw createError({ statusCode: 507, message: refusal })
}
