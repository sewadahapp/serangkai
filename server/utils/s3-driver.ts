import { AwsClient } from 'aws4fetch'

export interface S3DriverOptions {
  accessKeyId: string
  secretAccessKey: string
  endpoint: string
  region: string
  bucket: string
}

/** SHA-256 of the empty string, the signed payload hash for bodyless calls. */
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

/**
 * Fail with an actionable message before any request is attempted. A bare
 * hostname (as Backblaze displays it) is a common configuration mistake and
 * would otherwise surface as a cryptic URL parse error on the first upload.
 */
function validateOptions(options: S3DriverOptions) {
  if (!options.accessKeyId) throw new Error('S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3.')
  if (!options.secretAccessKey) throw new Error('S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3.')
  if (!options.region) throw new Error('S3_REGION is required when STORAGE_DRIVER=s3.')
  if (!options.bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(options.bucket)) {
    throw new Error('S3_BUCKET must be a valid bucket name (3-63 lowercase letters, digits, dots, or hyphens).')
  }
  let endpoint: URL
  try {
    endpoint = new URL(options.endpoint)
  } catch {
    throw new Error('S3_ENDPOINT must be an absolute URL including the scheme, for example https://s3.us-west-004.backblazeb2.com.')
  }
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') {
    throw new Error('S3_ENDPOINT must use http or https, for example https://s3.us-west-004.backblazeb2.com.')
  }
}

/**
 * Minimal S3-compatible object storage driver for Backblaze B2 (and any other
 * S3 API that accepts SigV4 with a signed payload hash).
 *
 * unstorage's built-in s3 driver runs on Workers but maps every 404 to null —
 * including failed writes, which silently loses rangka — and its listing
 * ignores the prefix and pagination. This driver keeps the same unstorage
 * surface with loud write errors and prefix-aware, paginated listing. Signing
 * is aws4fetch (Web Crypto + fetch), so one implementation runs on Node, Bun,
 * and Cloudflare Workers without Node-only APIs.
 */
export function s3Driver(options: S3DriverOptions) {
  validateOptions(options)
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region,
    service: 's3',
    retries: 3,
  })
  const baseURL = `${options.endpoint.replace(/\/+$/, '')}/${options.bucket}`
  // unstorage hands drivers colon-separated keys; map them back to path
  // segments (as the fs driver does) so objects keep the userId/rangkaId/…
  // hierarchy. Encode per segment so spaces and unicode in bundle filenames
  // survive.
  const storageKey = (key: string) => key.replace(/:/g, '/')
  // `.`/`..` survive encodeURIComponent and the URL parser resolves them, which
  // would address another object (or bucket). Refuse them like the fs driver.
  const objectURL = (key: string) => {
    const segments = storageKey(key).split('/')
    if (segments.some(segment => segment === '.' || segment === '..')) {
      throw new Error(`[s3] Invalid key: ${JSON.stringify(key)}. It should not contain . or .. segments`)
    }
    return `${baseURL}/${segments.map(encodeURIComponent).join('/')}`
  }

  // Workers restrict network I/O in global scope, where Nitro initializes
  // plugins, so the bucket is probed once inside the first request instead.
  // A rejected probe clears the cache, so a transient failure is retried.
  let readyPromise: Promise<void> | undefined
  function ready(): Promise<void> {
    readyPromise ||= (async () => {
      const url = new URL(baseURL)
      url.searchParams.set('list-type', '2')
      url.searchParams.set('max-keys', '1')
      const res = await client.fetch(url.toString(), {
        method: 'GET',
        headers: { 'x-amz-content-sha256': EMPTY_SHA256 },
      })
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200)
        throw new Error(`S3 bucket probe failed with ${res.status}: ${detail}. Check S3_ENDPOINT, S3_REGION, S3_BUCKET, and the credentials.`)
      }
    })()
    return readyPromise.catch((error) => {
      readyPromise = undefined
      throw error
    })
  }

  async function payloadHash(body: string | Uint8Array | ArrayBuffer): Promise<string> {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  }

  async function request(method: string, url: string, body?: string | Uint8Array | ArrayBuffer) {
    await ready()
    const res = await client.fetch(url, {
      method,
      headers: { 'x-amz-content-sha256': body === undefined ? EMPTY_SHA256 : await payloadHash(body) },
      body,
    })
    if (res.ok) return res
    // A missing object is a normal read result, and deleting it is a no-op.
    // Every other failure must reach the caller: a dropped write loses data.
    if (res.status === 404 && method !== 'PUT' && method !== 'POST') return null
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    throw new Error(`S3 ${method} failed with ${res.status}: ${detail}`)
  }

  function decodeXml(value: string): string {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
  }

  async function listKeys(base: string): Promise<string[]> {
    const keys: string[] = []
    let token: string | undefined
    do {
      const url = new URL(baseURL)
      url.searchParams.set('list-type', '2')
      if (base) url.searchParams.set('prefix', storageKey(base))
      if (token) url.searchParams.set('continuation-token', token)
      const res = await request('GET', url.toString())
      const xml = await res!.text()
      for (const match of xml.matchAll(/<Contents[^>]*>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g)) {
        keys.push(decodeXml(match[1]))
      }
      const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1]
      token = next ? decodeXml(next) : undefined
    } while (token)
    return keys
  }

  return {
    name: 'serangkai-s3',
    options,

    /** Probe the bucket so a misconfigured deployment fails on its first request. */
    async getInstance() {
      await ready()
      return client
    },

    async getItem(key: string) {
      const res = await request('GET', objectURL(key))
      return res ? res.text() : null
    },
    async getItemRaw(key: string) {
      const res = await request('GET', objectURL(key))
      return res ? new Uint8Array(await res.arrayBuffer()) : null
    },
    async setItem(key: string, value: string | Uint8Array | ArrayBuffer) {
      await request('PUT', objectURL(key), value)
    },
    async setItemRaw(key: string, value: string | Uint8Array | ArrayBuffer) {
      await request('PUT', objectURL(key), value)
    },
    async hasItem(key: string) {
      return (await request('HEAD', objectURL(key))) !== null
    },
    async removeItem(key: string) {
      await request('DELETE', objectURL(key))
    },
    getKeys(base = '') {
      return listKeys(base)
    },
  }
}