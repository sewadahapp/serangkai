import yauzl from 'yauzl'
import { promises as fs } from 'node:fs'
import { join, normalize, relative, dirname, sep } from 'node:path'

export const MAX_BUNDLE_FILES = 500
export const MAX_BUNDLE_UNPACKED_BYTES = 100 * 1024 * 1024

function safeEntryName(name: string) {
  if (!name || name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(name)) return false
  const clean = normalize(name.replaceAll('\\', '/'))
  return clean !== '..' && !clean.startsWith(`..${name.includes('/') ? '/' : ''}`) && !clean.split('/').includes('..')
}

export async function extractBundle(buffer: Buffer, destination: string) {
  await fs.mkdir(destination, { recursive: true })
  let files = 0
  let unpackedBytes = 0
  return new Promise<{ files: number; bytes: number }>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error('Invalid ZIP archive'))
      let finished = false
      const fail = (reason: Error) => { if (!finished) { finished = true; zip.close(); reject(reason) } }
      zip.readEntry()
      zip.on('entry', entry => {
        if (finished) return
        if (!safeEntryName(entry.fileName)) return fail(new Error('Bundle contains an unsafe path'))
        if (entry.fileName.endsWith('/')) { zip.readEntry(); return }
        files++
        unpackedBytes += entry.uncompressedSize
        if (files > MAX_BUNDLE_FILES) return fail(new Error('Bundle contains too many files'))
        if (unpackedBytes > MAX_BUNDLE_UNPACKED_BYTES) return fail(new Error('Bundle exceeds the unpacked size limit'))
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(streamError || new Error('Could not read bundle entry'))
          const outputPath = join(destination, entry.fileName)
          const resolved = relative(destination, outputPath)
          if (resolved.startsWith('..') || resolved.includes(`..${sep}`)) return fail(new Error('Bundle contains an unsafe path'))
          fs.mkdir(dirname(outputPath), { recursive: true }).then(() => {
            const chunks: Buffer[] = []
            stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
            stream.on('error', fail)
            stream.on('end', async () => {
              try { await fs.writeFile(outputPath, Buffer.concat(chunks)); zip.readEntry() } catch (writeError) { fail(writeError as Error) }
            })
          }).catch(fail)
        })
      })
      zip.on('end', () => { if (!finished) { finished = true; resolve({ files, bytes: unpackedBytes }) } })
      zip.on('error', fail)
    })
  })
}

export function bundleMimeType(path: string) {
  const ext = path.toLowerCase().split('.').pop()
  return ({ html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8' } as Record<string, string>)[ext || ''] || 'application/octet-stream'
}
