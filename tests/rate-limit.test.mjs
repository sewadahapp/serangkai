import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRateLimiter, clientBucketKey } from '../server/utils/rate-limit.ts'

test('allows up to the limit within a window, then refuses', () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000 })
  for (let i = 0; i < 3; i++) {
    const result = limiter.hit('a')
    assert.equal(result.limited, false, `hit ${i + 1} should pass`)
    assert.equal(result.remaining, 2 - i)
  }
  const blocked = limiter.hit('a')
  assert.equal(blocked.limited, true)
  assert.equal(blocked.remaining, 0)
  assert.ok(blocked.retryAfterSeconds >= 1)
})

test('buckets are independent per key', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 })
  assert.equal(limiter.hit('a').limited, false)
  assert.equal(limiter.hit('a').limited, true)
  // A different address is unaffected.
  assert.equal(limiter.hit('b').limited, false)
})

test('the window resets', async () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 30 })
  assert.equal(limiter.hit('a').limited, false)
  assert.equal(limiter.hit('a').limited, true)
  await new Promise(resolve => setTimeout(resolve, 45))
  assert.equal(limiter.hit('a').limited, false)
})

test('reset clears a key so a successful request is not penalised', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 })
  limiter.hit('a')
  limiter.hit('a')
  assert.equal(limiter.hit('a').limited, true)
  limiter.reset('a')
  assert.equal(limiter.hit('a').limited, false)
})

test('the bucket map stays bounded under many distinct keys', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 50 })
  for (let i = 0; i < 500; i++) limiter.hit(`key-${i}`)
  assert.ok(limiter.size() <= 50, `bucket size ${limiter.size()} should stay bounded`)
})

test('the client key prefers the first forwarded hop and falls back to the socket', () => {
  assert.equal(clientBucketKey({ node: { req: { headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } } } }), '203.0.113.9')
  assert.equal(clientBucketKey({ node: { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } } }), '127.0.0.1')
  assert.equal(clientBucketKey({}), 'unknown')
  assert.equal(clientBucketKey(undefined), 'unknown')
})
