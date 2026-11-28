/**
 * Framing-page side of `serangkai.data` (see server/utils/rangka-data-bridge.ts).
 *
 * The sandboxed rangka posts a request; this performs it against the data API
 * with the page's own credentials and posts the result back. The caller must
 * already have matched `event.source` to its own iframe. Everything in the
 * message is untrusted: names are checked before they reach a URL, writes are
 * refused unless this page allows them, and only the documented fields are
 * forwarded.
 */
export interface RangkaDataBridgeOptions {
  /** Base URL of the data API, e.g. `/api/rangka/<id>/data` or `/api/share-data/<slug>`. */
  endpoint: string
  /** Query parameters to append, such as an unlisted share key. */
  query?: Record<string, string>
  /** Whether this page may write. Shared pages are read-only. */
  writable: boolean
}

const NAME = /^[A-Za-z0-9_-]{1,64}$/
const OPS = new Set(['info', 'list', 'get', 'set', 'update', 'delete'])
const WRITE_OPS = new Set(['set', 'update', 'delete'])

interface DataRequest {
  type: 'serangkai:data'
  key?: unknown
  id: number
  op: string
  collection?: unknown
  docId?: unknown
  data?: unknown
}

/** A fresh per-load bridge key; works outside secure contexts (plain http on a LAN). */
export function createBridgeKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_')
}

export function isRangkaDataRequest(value: unknown): value is DataRequest {
  const message = value as DataRequest | null
  return !!message && message.type === 'serangkai:data' && typeof message.id === 'number' && typeof message.op === 'string'
}

class BridgeError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function name(kind: string, value: unknown) {
  if (typeof value !== 'string' || !NAME.test(value)) {
    throw new BridgeError(400, `Invalid ${kind}: use 1-64 letters, digits, "-" or "_".`)
  }
  return encodeURIComponent(value)
}

async function perform(request: DataRequest, options: RangkaDataBridgeOptions) {
  if (!OPS.has(request.op)) throw new BridgeError(400, `Unknown data operation "${request.op}".`)
  if (request.op === 'info') return { available: true, writable: options.writable }
  if (WRITE_OPS.has(request.op) && !options.writable) {
    throw new BridgeError(403, 'This page is read-only. Open the rangka in Serangkai to make changes.')
  }

  const collection = name('collection', request.collection)
  const query = options.query
  if (request.op === 'list') {
    const result = await $fetch<{ documents: unknown[] }>(`${options.endpoint}/${collection}`, { query })
    return result.documents
  }

  const docId = name('document id', request.docId)
  const url = `${options.endpoint}/${collection}/${docId}`
  if (request.op === 'get') {
    // A missing document is a normal answer here, not an error.
    return (await $fetch<{ document: unknown }>(url, { query: { ...query, optional: '1' } })).document ?? null
  }
  if (request.op === 'delete') {
    return (await $fetch<{ deleted: boolean }>(url, { method: 'DELETE', query })).deleted
  }

  // Structured clone already copied the value; reject anything that would not
  // survive JSON before sending it.
  let data: unknown
  try {
    data = JSON.parse(JSON.stringify(request.data ?? null))
  } catch {
    throw new BridgeError(400, 'A document must be JSON serializable.')
  }
  const method = request.op === 'update' ? 'PATCH' : 'PUT'
  return (await $fetch<{ document: unknown }>(url, { method, query, body: { data } })).document
}

/** Handles one request and posts `serangkai:data-result` back to the frame. */
export async function answerRangkaDataRequest(target: Window, request: DataRequest, options: RangkaDataBridgeOptions) {
  let reply: Record<string, unknown>
  try {
    reply = { ok: true, result: await perform(request, options) }
  } catch (error: any) {
    const status = error instanceof BridgeError ? error.status : (error?.statusCode ?? error?.status ?? 500)
    const message = error instanceof BridgeError
      ? error.message
      : (error?.data?.message || error?.statusMessage || error?.message || 'Rangka data request failed.')
    reply = { ok: false, error: { status, message } }
  }
  // targetOrigin '*' is required: the sandboxed frame has an opaque origin. The
  // reply only goes to the window that asked.
  target.postMessage({ type: 'serangkai:data-result', id: request.id, ...reply }, '*')
}
