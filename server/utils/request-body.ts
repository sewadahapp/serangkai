import { createError, getHeader, getMethod, getRequestWebStream } from 'h3'

const PAYLOAD_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export interface BoundedBodyOptions {
  /** Hard cap on the bytes read from the request. */
  maxBytes?: number
  /**
   * `json` and `form` reject a different content type. `auto` accepts both and
   * falls back to JSON, which is what the older OAuth routes did.
   */
  parse?: 'json' | 'form' | 'auto'
}

/**
 * Read and parse a request body with a hard byte limit.
 *
 * `readBody` buffers whatever the client sends, so a `Content-Length` check
 * alone is bypassable with chunked transfer encoding. This reads the web stream
 * and cancels as soon as the cap is crossed, which bounds memory on Node,
 * Bun, and Workers alike.
 */
export async function readBoundedBody(
  event: any,
  options: BoundedBodyOptions = {},
): Promise<Record<string, any>> {
  const { maxBytes = 32 * 1024, parse = 'auto' } = options
  if (!PAYLOAD_METHODS.has(String(getMethod(event)).toUpperCase())) return {}

  const declared = Number(getHeader(event, 'content-length') || 0)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw createError({ statusCode: 413, message: 'Request body is too large.' })
  }

  const contentType = String(getHeader(event, 'content-type') || '').toLowerCase()
  const isJson = contentType.includes('application/json')
  const isForm = contentType.includes('application/x-www-form-urlencoded')
  if (parse === 'json' && !isJson) {
    throw createError({ statusCode: 415, message: 'The request body must be JSON.' })
  }
  if (parse === 'form' && !isForm) {
    throw createError({ statusCode: 415, message: 'The request body must be form encoded.' })
  }

  const stream = getRequestWebStream(event)
  if (!stream) return {}

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw createError({ statusCode: 413, message: 'Request body is too large.' })
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (!total) return {}
  const text = new TextDecoder().decode(concat(chunks, total))

  if (isForm || (parse === 'auto' && !isJson)) {
    return formObject(text)
  }

  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    throw createError({ statusCode: 400, message: 'The request body must be valid JSON.' })
  }
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

/** Preserve repeated form fields as arrays; `scopes` is submitted per checkbox. */
function formObject(text: string): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of new URLSearchParams(text)) {
    const existing = result[key]
    if (existing === undefined) result[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else result[key] = [existing, value]
  }
  return result
}
