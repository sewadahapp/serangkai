import { createHmac, timingSafeEqual } from 'node:crypto'

function secret() {
  return process.env.SHARE_SECRET || process.env.JWT_SECRET || 'dev-share-secret-change-me'
}

export function signShareKey(artifactId: string) {
  return createHmac('sha256', secret()).update(artifactId).digest('hex')
}

export function isValidShareKey(artifactId: string, key: string | undefined) {
  if (!key || !/^[a-f0-9]{64}$/.test(key)) return false
  const expected = Buffer.from(signShareKey(artifactId), 'hex')
  const received = Buffer.from(key, 'hex')
  return expected.length === received.length && timingSafeEqual(expected, received)
}
