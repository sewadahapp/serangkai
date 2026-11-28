import { and, asc, eq, sql } from 'drizzle-orm'
import { rangkaData, rangkaItems } from '../db/schema'
import { formatByteSize } from '../../shared/byte-size'
import { getRequestDatabase } from '../db/adapter'
import { readBoundedBody } from './request-body'
import { requireScope } from './require-auth'
import { storageWriteRefusal } from './storage-quota'

/**
 * Rangka data: small JSON documents an interactive rangka keeps, such as the
 * cards on a kanban board or rows in a tracker.
 *
 * Documents live in the database, grouped into named collections and scoped to
 * one rangka. They are not versioned: a moved card updates one document instead
 * of copying the whole rangka into a new version. Every write path (the HTML
 * bridge through REST, and MCP) goes through this module so the limits and
 * storage accounting cannot drift apart.
 */

/** Largest single document, as stored JSON. */
export const MAX_DOCUMENT_BYTES = 64 * 1024
/** Most documents one rangka can hold across all its collections. */
export const MAX_DOCUMENTS_PER_RANGKA = 5000
/** Most data bytes one rangka can hold; the account storage limit also applies. */
export const MAX_DATA_BYTES_PER_RANGKA = 5 * 1024 * 1024
/** Request bodies carry one document plus a little JSON framing. */
export const MAX_DATA_BODY_BYTES = MAX_DOCUMENT_BYTES + 4 * 1024

const NAME = /^[A-Za-z0-9_-]{1,64}$/

export type DataWriter = 'owner' | 'agent'

export interface RangkaDocument {
  id: string
  data: Record<string, unknown>
  updatedAt: Date
  updatedBy: string
}

export class RangkaDataError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export function assertName(kind: 'collection' | 'document id', value: unknown): string {
  if (typeof value !== 'string' || !NAME.test(value)) {
    throw new RangkaDataError(400, `Invalid ${kind}: use 1-64 letters, digits, "-" or "_".`)
  }
  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Normalizes a document body to JSON and returns it with its stored size. */
function encode(value: unknown): { data: Record<string, unknown>; bytes: number } {
  if (!isPlainObject(value)) throw new RangkaDataError(400, 'A document must be a JSON object.')
  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    throw new RangkaDataError(400, 'A document must be JSON serializable.')
  }
  const bytes = Buffer.byteLength(json)
  if (bytes > MAX_DOCUMENT_BYTES) {
    throw new RangkaDataError(413, `A document can be at most ${formatByteSize(MAX_DOCUMENT_BYTES)}; this one is ${formatByteSize(bytes)}.`)
  }
  return { data: JSON.parse(json), bytes }
}

const toDocument = (row: typeof rangkaData.$inferSelect): RangkaDocument => ({
  id: row.docId,
  data: row.data,
  updatedAt: row.updatedAt,
  updatedBy: row.updatedBy,
})

/** The rangka when it belongs to `userId`, else null. */
export async function findOwnedRangka(db: any, userId: string, rangkaId: string) {
  return await db.select({ id: rangkaItems.id, userId: rangkaItems.userId, type: rangkaItems.type }).from(rangkaItems)
    .where(and(eq(rangkaItems.id, rangkaId), eq(rangkaItems.userId, userId))).get() ?? null
}

export async function listCollections(db: any, rangkaId: string) {
  const rows = await db.select({
    name: rangkaData.collection,
    count: sql<number>`count(*)`,
    bytes: sql<number>`coalesce(sum(${rangkaData.bytes}), 0)`,
  }).from(rangkaData).where(eq(rangkaData.rangkaId, rangkaId))
    .groupBy(rangkaData.collection).orderBy(asc(rangkaData.collection))
  return rows.map((row: any) => ({ name: row.name, count: Number(row.count), bytes: Number(row.bytes) }))
}

export async function listDocuments(db: any, rangkaId: string, collection: string): Promise<RangkaDocument[]> {
  assertName('collection', collection)
  const rows = await db.select().from(rangkaData)
    .where(and(eq(rangkaData.rangkaId, rangkaId), eq(rangkaData.collection, collection)))
    .orderBy(asc(rangkaData.createdAt), asc(rangkaData.docId))
    .limit(MAX_DOCUMENTS_PER_RANGKA)
  return rows.map(toDocument)
}

async function findRow(db: any, rangkaId: string, collection: string, docId: string) {
  return await db.select().from(rangkaData).where(and(
    eq(rangkaData.rangkaId, rangkaId),
    eq(rangkaData.collection, collection),
    eq(rangkaData.docId, docId),
  )).get() ?? null
}

export async function getDocument(db: any, rangkaId: string, collection: string, docId: string): Promise<RangkaDocument | null> {
  assertName('collection', collection)
  assertName('document id', docId)
  const row = await findRow(db, rangkaId, collection, docId)
  return row ? toDocument(row) : null
}

async function rangkaTotals(db: any, rangkaId: string) {
  const row = await db.select({
    count: sql<number>`count(*)`,
    bytes: sql<number>`coalesce(sum(${rangkaData.bytes}), 0)`,
  }).from(rangkaData).where(eq(rangkaData.rangkaId, rangkaId)).get()
  return { count: Number(row?.count || 0), bytes: Number(row?.bytes || 0) }
}

/**
 * Creates or replaces a document (`merge` shallow-merges into the existing one
 * instead). Checks the per-rangka limits and the account storage limit for the
 * bytes the write adds.
 */
export async function writeDocument(db: any, options: {
  userId: string
  rangkaId: string
  collection: string
  docId: string
  data: unknown
  merge?: boolean
  writer: DataWriter
}): Promise<RangkaDocument> {
  const { userId, rangkaId, writer } = options
  const collection = assertName('collection', options.collection)
  const docId = assertName('document id', options.docId)
  if (options.merge && !isPlainObject(options.data)) throw new RangkaDataError(400, 'An update must be a JSON object.')

  const existing = await findRow(db, rangkaId, collection, docId)
  const merged = options.merge ? { ...(existing?.data || {}), ...(options.data as Record<string, unknown>) } : options.data
  const { data, bytes } = encode(merged)
  const added = bytes - (existing?.bytes || 0)

  // Early, friendly refusals. The write below re-checks the per-rangka limits
  // atomically, so concurrent writes cannot push a rangka past them.
  const totals = await rangkaTotals(db, rangkaId)
  if (!existing && totals.count >= MAX_DOCUMENTS_PER_RANGKA) throw documentLimitError()
  if (added > 0 && totals.bytes + added > MAX_DATA_BYTES_PER_RANGKA) throw byteLimitError()
  if (added > 0) {
    const refusal = await storageWriteRefusal(db, userId, added)
    if (refusal) throw new RangkaDataError(507, refusal)
  }

  const now = new Date()
  const written = await guardedUpsert(db, { rangkaId, collection, docId, json: JSON.stringify(data), bytes, writer, now })
  if (!written) {
    // Another write took the room between the check above and this one.
    const latest = await rangkaTotals(db, rangkaId)
    throw latest.count >= MAX_DOCUMENTS_PER_RANGKA && !(await findRow(db, rangkaId, collection, docId))
      ? documentLimitError()
      : byteLimitError()
  }
  return { id: docId, data, updatedAt: now, updatedBy: writer }
}

const documentLimitError = () => new RangkaDataError(413, `A rangka can hold at most ${MAX_DOCUMENTS_PER_RANGKA} documents. Delete some before adding more.`)
const byteLimitError = () => new RangkaDataError(413, `A rangka can hold at most ${formatByteSize(MAX_DATA_BYTES_PER_RANGKA)} of data. Delete some documents before adding more.`)

/**
 * Inserts or replaces one document in a single statement that only applies
 * while the rangka stays within its document and byte limits. A single SQL
 * statement is atomic on SQLite, D1, and libSQL alike, so two concurrent writes
 * cannot both pass the check. "Other" means every document except this one,
 * which is what a replacement is measured against; a write that does not grow
 * the document is always allowed. Returns whether the row was written.
 */
async function guardedUpsert(db: any, row: { rangkaId: string; collection: string; docId: string; json: string; bytes: number; writer: DataWriter; now: Date }) {
  const { rangkaId, collection, docId, json, bytes, writer } = row
  const seconds = Math.floor(row.now.getTime() / 1000)
  const others = sql`rangka_id = ${rangkaId} AND NOT (collection = ${collection} AND doc_id = ${docId})`
  const rows = await db.all(sql`
    INSERT INTO rangka_data (rangka_id, collection, doc_id, data, bytes, updated_by, created_at, updated_at)
    SELECT ${rangkaId}, ${collection}, ${docId}, ${json}, ${bytes}, ${writer}, ${seconds}, ${seconds}
    WHERE (SELECT count(*) FROM rangka_data WHERE ${others}) < ${MAX_DOCUMENTS_PER_RANGKA}
      AND (
        (SELECT coalesce(sum(bytes), 0) FROM rangka_data WHERE ${others}) + ${bytes} <= ${MAX_DATA_BYTES_PER_RANGKA}
        OR ${bytes} <= coalesce((SELECT bytes FROM rangka_data WHERE rangka_id = ${rangkaId} AND collection = ${collection} AND doc_id = ${docId}), 0)
      )
    ON CONFLICT (rangka_id, collection, doc_id) DO UPDATE SET
      data = excluded.data, bytes = excluded.bytes, updated_by = excluded.updated_by, updated_at = excluded.updated_at
    RETURNING doc_id
  `)
  return rows.length > 0
}

/** Deletes one document; returns whether it existed. */
export async function deleteDocument(db: any, rangkaId: string, collection: string, docId: string): Promise<boolean> {
  assertName('collection', collection)
  assertName('document id', docId)
  const existing = await findRow(db, rangkaId, collection, docId)
  if (!existing) return false
  await db.delete(rangkaData).where(and(
    eq(rangkaData.rangkaId, rangkaId),
    eq(rangkaData.collection, collection),
    eq(rangkaData.docId, docId),
  ))
  return true
}

/** Deletes every document of a rangka; returns how many and the bytes freed. */
export async function clearDocuments(db: any, rangkaId: string) {
  const totals = await rangkaTotals(db, rangkaId)
  await db.delete(rangkaData).where(eq(rangkaData.rangkaId, rangkaId))
  return { deleted: totals.count, freedBytes: totals.bytes }
}

/** Total stored bytes of a rangka's data; used to check quota before copying it. */
export async function dataBytes(db: any, rangkaId: string) {
  return (await rangkaTotals(db, rangkaId)).bytes
}

/**
 * Copies every document of one rangka to another in a single statement. The
 * copy has the same count and size as the source, so it is within the same
 * per-rangka limits; the caller checks the account storage limit.
 */
export async function copyDocuments(db: any, fromRangkaId: string, toRangkaId: string) {
  const seconds = Math.floor(Date.now() / 1000)
  await db.run(sql`
    INSERT INTO rangka_data (rangka_id, collection, doc_id, data, bytes, updated_by, created_at, updated_at)
    SELECT ${toRangkaId}, collection, doc_id, data, bytes, updated_by, created_at, ${seconds}
    FROM rangka_data WHERE rangka_id = ${fromRangkaId}
  `)
}

/**
 * Only HTML rangka run code that can use their data, so only they keep it.
 * Writes elsewhere are refused rather than stored where no page shows them.
 */
export const DATA_TYPES_MESSAGE = 'Only HTML rangka keep data.'
export function keepsData(rangka: { type?: string | null }) {
  return rangka.type === 'html'
}

/** Converts module errors to an H3 error for REST handlers. */
export function toHttpError(error: unknown) {
  if (error instanceof RangkaDataError) return createError({ statusCode: error.statusCode, message: error.message })
  return error
}

/** Who a REST request writes as: an API token is an agent, a session is the owner. */
export function requestWriter(event: any): DataWriter {
  return event.context.apiToken ? 'agent' : 'owner'
}

/**
 * Resolves the rangka a REST data request addresses. Reads need the `read`
 * scope and writes `write`, like the rest of the rangka API; a browser session
 * is the owner. A rangka owned by someone else is reported as not found.
 */
export async function loadDataRangka(event: any, scope: 'read' | 'write') {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, scope)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID required' })
  const rangka = await findOwnedRangka(db, user.id, id)
  if (!rangka) throw createError({ statusCode: 404, message: 'Rangka not found' })
  if (scope === 'write' && !keepsData(rangka)) throw createError({ statusCode: 400, message: DATA_TYPES_MESSAGE })
  setHeader(event, 'Cache-Control', 'no-store')
  return { db, user, rangka }
}

/** Reads `{ "data": { … } }` from a bounded JSON body. */
export async function readDocumentBody(event: any): Promise<unknown> {
  const body = await readBoundedBody(event, { maxBytes: MAX_DATA_BODY_BYTES, parse: 'json' })
  if (!body || !('data' in body)) throw createError({ statusCode: 400, message: 'Send the document as { "data": { … } }.' })
  return body.data
}
