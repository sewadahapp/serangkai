import yauzl from 'yauzl'
import { artifactStorage, writeArtifact } from './artifact-storage'

export const MAX_BUNDLE_FILES = 500
export const MAX_BUNDLE_UNPACKED_BYTES = 100 * 1024 * 1024

function safeEntryName(name: string) {
  // `:` is a storage key separator (and covers Windows drive letters), so an
  // entry like `..:..:other` must not reach `writeArtifact`.
  if (!name || name.includes('\0') || name.includes(':') || name.startsWith('/')) return false
  const clean = name.replaceAll('\\', '/')
  return clean !== '..' && !clean.startsWith('../') && !clean.split('/').includes('..')
}

/**
 * Extracts a static bundle into the artifact storage under `prefix`.
 *
 * Entries are written one at a time, so a 100 MB unpacked archive does not
 * have to be held in memory all at once. The same keys work on the filesystem,
 * R2, and S3 because they go through Nitro's storage layer.
 */
export async function extractBundle(buffer: Buffer, prefix: string) {
  let files = 0
  let unpackedBytes = 0

  return new Promise<{ files: number; bytes: number }>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error('Invalid ZIP archive'))

      let finished = false
      const fail = (reason: Error) => {
        if (finished) return
        finished = true
        zip.close()
        reject(reason)
      }

      zip.readEntry()
      zip.on('entry', entry => {
        if (finished) return
        if (!safeEntryName(entry.fileName)) return fail(new Error('Bundle contains an unsafe path'))
        if (entry.fileName.endsWith('/')) {
          zip.readEntry()
          return
        }

        files++
        unpackedBytes += entry.uncompressedSize
        if (files > MAX_BUNDLE_FILES) return fail(new Error('Bundle contains too many files'))
        if (unpackedBytes > MAX_BUNDLE_UNPACKED_BYTES) return fail(new Error('Bundle exceeds the unpacked size limit'))

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(streamError || new Error('Could not read bundle entry'))

          const chunks: Buffer[] = []
          stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
          stream.on('error', fail)
          stream.on('end', async () => {
            try {
              await writeArtifact(`${prefix}/${entry.fileName}`, Buffer.concat(chunks))
              if (!finished) zip.readEntry()
            } catch (writeError) {
              fail(writeError as Error)
            }
          })
        })
      })

      zip.on('end', () => {
        if (!finished) {
          finished = true
          resolve({ files, bytes: unpackedBytes })
        }
      })
      zip.on('error', fail)
    })
  })
}

export function bundleMimeType(path: string) {
  const ext = path.toLowerCase().split('.').pop()
  return ({
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    ico: 'image/x-icon',
    txt: 'text/plain; charset=utf-8',
  } as Record<string, string>)[ext || ''] || 'application/octet-stream'
}

export async function deleteBundle(prefix: string) {
  const storage = artifactStorage()
  const keys = await storage.getKeys(prefix)
  await Promise.all(keys.map(key => storage.removeItem(key)))
}
