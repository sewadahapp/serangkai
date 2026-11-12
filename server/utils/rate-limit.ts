/**
 * Fixed-window rate limiter for the OAuth surface.
 *
 * Scope and honesty:
 *  - This is **per process**. On Cloudflare Workers each isolate and each
 *    colo has its own map, so a distributed attacker can exceed the limit;
 *    it raises the cost of a naive flood rather than guaranteeing a ceiling.
 *    A durable limiter would need a D1/KV counter, which is a deployment
 *    decision rather than something to bolt on silently.
 *  - Buckets are pruned lazily, so an instance that sees many distinct
 *    addresses cannot grow without bound.
 *  - The key is coarse (client address) and is never used for authorization.
 */
export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Max bucket keys retained before stale ones are swept. */
  maxKeys?: number
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  retryAfterSeconds: number
}

export function createRateLimiter(options: RateLimitOptions) {
  const { limit, windowMs, maxKeys = 10_000 } = options
  const buckets = new Map<string, { count: number; resetAt: number }>()

  function sweep(now: number) {
    if (buckets.size < maxKeys) return
    for (const [key, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(key)
    }
    // Still full of live buckets: drop the oldest insertions. Map preserves
    // insertion order, so this is the cheapest bounded approximation.
    if (buckets.size >= maxKeys) {
      let excess = buckets.size - maxKeys + 1
      for (const key of buckets.keys()) {
        buckets.delete(key)
        if (--excess <= 0) break
      }
    }
  }

  return {
    /** Count one attempt against `key`. */
    hit(key: string): RateLimitResult {
      const now = Date.now()
      sweep(now)
      const entry = buckets.get(key)
      if (!entry || entry.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { limited: false, remaining: limit - 1, retryAfterSeconds: 0 }
      }
      entry.count++
      if (entry.count > limit) {
        return {
          limited: true,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
        }
      }
      return { limited: false, remaining: Math.max(0, limit - entry.count), retryAfterSeconds: 0 }
    },
    /** Clear a bucket, e.g. after a successful authentication. */
    reset(key: string) {
      buckets.delete(key)
    },
    /** Test/diagnostic view. */
    size() {
      return buckets.size
    },
  }
}

function envList(value: string | undefined): string[] {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

let warnedUntrustedProxy = false

/**
 * A forwarded header on a direct socket means a proxy sits in front, and
 * without trust every visitor shares the proxy's bucket. Warn once so the
 * operator can set `TRUST_PROXY`. Workers have no socket and use
 * `cf-connecting-ip`, so they are not affected and never warn.
 */
function warnUntrustedProxy(event: any, socket: string) {
  if (warnedUntrustedProxy || !event?.node?.req?.socket?.remoteAddress) return
  if (!event.node.req.headers?.['x-forwarded-for']) return
  warnedUntrustedProxy = true
  console.warn(
    `[serangkai] Requests from ${socket} carry X-Forwarded-For, but no proxy is trusted, `
    + 'so every client behind it shares one rate-limit bucket. If this is your reverse proxy, '
    + 'set TRUST_PROXY=true or TRUSTED_PROXY_IPS to its address.',
  )
}

/**
 * Coarse client bucket.
 *
 * `X-Forwarded-For` is caller-controlled unless a trusted proxy overwrites it,
 * so it is ignored by default. Set `TRUST_PROXY=true` when the app is behind a
 * proxy that sanitizes the header, or list the proxy's socket addresses in
 * `TRUSTED_PROXY_IPS`. The socket peer must match for the per-IP list to apply.
 *
 * This value only bounds throughput; it never authorizes anything.
 */
export function clientBucketKey(event: any, env: NodeJS.ProcessEnv = process.env): string {
  const socket = event?.node?.req?.socket?.remoteAddress
    || event?.context?.cloudflare?.request?.headers?.get?.('cf-connecting-ip')
    || 'unknown'

  const trustAll = String(env.TRUST_PROXY || '').toLowerCase() === 'true'
  const trustedPeers = envList(env.TRUSTED_PROXY_IPS)
  const trusted = trustAll || (socket !== 'unknown' && trustedPeers.includes(socket))
  if (!trusted) {
    warnUntrustedProxy(event, socket)
    return socket
  }

  const forwarded = String(event?.node?.req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim()
  return forwarded || socket
}
