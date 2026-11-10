import { createServer } from 'node:http'
import { createHash, createHmac } from 'node:crypto'

/**
 * Local S3-compatible mock for storage tests. Speaks the Backblaze B2 wire
 * dialect: SigV4 with a signed payload hash, ListObjectsV2 with continuation
 * tokens, XML errors. Every signature is re-derived with node:crypto — an
 * implementation independent of the driver's aws4fetch/Web Crypto signing.
 */

const sha256Hex = bytes => createHash('sha256').update(bytes).digest('hex')
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()
const rfc3986 = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const xmlEscape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function startS3Mock({
  region = 'us-west-004',
  bucket = 'test-bucket',
  keyId = '005b2testkey0000000000001',
  secret = 'K005b2testsecret00000000000000000000000',
  pageSize = 2,
} = {}) {
  const objects = new Map()
  const requests = []

  function verifySignature(req, url, body) {
    const auth = req.headers.authorization || ''
    const match = auth.match(/^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]+)$/)
    if (!match) return false
    const [, presentedKeyId, date, presentedRegion, service, signedHeaders, signature] = match
    if (presentedKeyId !== keyId || presentedRegion !== region || service !== 's3') return false

    const payloadHash = req.headers['x-amz-content-sha256']
    if (!payloadHash || payloadHash !== sha256Hex(body)) return false

    const pairs = [...url.searchParams]
      .map(([k, v]) => [rfc3986(k), rfc3986(v)])
      .sort(([a, b], [c, d]) => a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0)
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    const headers = signedHeaders.split(';')
      .map(name => `${name}:${name === 'host' ? req.headers.host : String(req.headers[name] || '').trim()}`)
      .join('\n')
    const canonical = [req.method, url.pathname, pairs, `${headers}\n`, signedHeaders, payloadHash].join('\n')
    const scope = `${date}/${region}/${service}/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', req.headers['x-amz-date'], scope, sha256Hex(canonical)].join('\n')
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), 'aws4_request')
    return hmac(signingKey, stringToSign).toString('hex') === signature
  }

  function listXml(prefix, maxKeys, continuationToken) {
    const all = [...objects.keys()].filter(key => key.startsWith(prefix)).sort()
    const offset = continuationToken ? Number(Buffer.from(continuationToken, 'base64url').toString()) : 0
    const size = Math.min(Number(maxKeys) || pageSize, pageSize)
    const page = all.slice(offset, offset + size)
    const truncated = offset + size < all.length
    const token = truncated ? Buffer.from(String(offset + size)).toString('base64url') : null
    return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<Name>${bucket}</Name><Prefix>${xmlEscape(prefix)}</Prefix><IsTruncated>${truncated}</IsTruncated>
${page.map(key => `<Contents><Key>${xmlEscape(key)}</Key><Size>${objects.get(key).length}</Size></Contents>`).join('')}
${token ? `<NextContinuationToken>${token}</NextContinuationToken>` : ''}
</ListBucketResult>`
  }

  function errorXml(res, status, code) {
    res.writeHead(status, { 'content-type': 'application/xml' })
    res.end(`<?xml version="1.0"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`)
  }

  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    const url = new URL(req.url, `http://${req.headers.host}`)
    requests.push({ method: req.method, path: url.pathname, signed: verifySignature(req, url, body) })
    if (!verifySignature(req, url, body)) return errorXml(res, 403, 'SignatureDoesNotMatch')

    const requestBucket = url.pathname.split('/')[1]
    if (requestBucket !== bucket) return errorXml(res, 404, 'NoSuchBucket')
    const key = decodeURIComponent(url.pathname.slice(`/${bucket}`.length).replace(/^\//, ''))

    if (req.method === 'GET' && !key) {
      res.writeHead(200, { 'content-type': 'application/xml' })
      return res.end(listXml(url.searchParams.get('prefix') || '', url.searchParams.get('max-keys'), url.searchParams.get('continuation-token')))
    }
    if (req.method === 'PUT') {
      objects.set(key, body)
      res.writeHead(200, { etag: `"${sha256Hex(body)}"` })
      return res.end()
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const value = objects.get(key)
      if (!value) return errorXml(res, 404, 'NoSuchKey')
      res.writeHead(200, { 'content-length': value.length, 'content-type': 'application/octet-stream' })
      return res.end(req.method === 'HEAD' ? undefined : value)
    }
    if (req.method === 'DELETE') {
      objects.delete(key)
      res.writeHead(204)
      return res.end()
    }
    return errorXml(res, 400, 'InvalidRequest')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

  return {
    endpoint: `http://127.0.0.1:${server.address().port}`,
    region,
    bucket,
    keyId,
    secret,
    objects,
    requests,
    async close() { await new Promise(resolve => server.close(resolve)) },
  }
}