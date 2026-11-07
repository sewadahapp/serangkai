import { createHmac, timingSafeEqual } from 'crypto'
import { getServerConfig } from './config'

function secret() {
  return getServerConfig().shareSecret
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
