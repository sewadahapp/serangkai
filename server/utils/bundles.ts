import yauzl from 'yauzl'
import { rangkaStorage, readRangkaBytes, writeRangka } from './rangka-storage'

export const MAX_BUNDLE_FILES = 500
export const MAX_BUNDLE_UNPACKED_BYTES = 100 * 1024 * 1024

/**
 * A bundle is a static website. Only these file types may be published from
 * one, and each is served with its own type. Anything else (executables,
 * scripts for other platforms, archives, office files) refuses the upload, so
 * a shared bundle cannot turn the Serangkai domain into a download host.
 * Files without an extension (LICENSE, README) are served as plain text.
 */
const BUNDLE_FILE_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8',
  xml: 'application/xml',
}

/** The served type for a bundle path, or null when the type is not allowed. */
export function bundleMimeType(path: string) {
  const name = path.split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'text/plain; charset=utf-8'
  return BUNDLE_FILE_TYPES[name.slice(dot + 1).toLowerCase()] || null
}

/** Types that are active documents and must be served with the sandbox policy. */
export function isBundleDocument(type: string) {
  return type.startsWith('text/html') || type.startsWith('image/svg') || type === 'application/xml'
}

function safeEntryName(name: string) {
  // `:` is a storage key separator (and covers Windows drive letters), so an
  // entry like `..:..:other` must not reach `writeRangka`.
  if (!name || name.includes('\0') || name.includes(':') || name.startsWith('/')) return false
  // Directory entries end in `/`; apart from that, every segment must be a real
  // name: no `..`, and no `.` or empty segment, which storage drivers refuse or
  // fold into another path.
  const clean = name.replaceAll('\\', '/').replace(/\/$/, '')
  return clean.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

/**
 * Files an operating system adds when zipping a folder. They are never part of
 * a site, so they are skipped instead of refusing the upload.
 */
function isSystemJunk(name: string) {
  const parts = name.split('/')
  const base = parts[parts.length - 1] || ''
  return parts[0] === '__MACOSX' || base.startsWith('.') || base === 'Thumbs.db' || base === 'desktop.ini'
}

type BundleEntry = { name: string; size: number }
type BundlePlan = { files: BundleEntry[]; root: string; bytes: number }

function listEntries(buffer: Buffer) {
  return new Promise<Array<BundleEntry & { directory: boolean }>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error || new Error('Invalid ZIP archive'))
      const entries: Array<BundleEntry & { directory: boolean }> = []
      zip.on('entry', (entry) => {
        entries.push({ name: entry.fileName, size: entry.uncompressedSize, directory: entry.fileName.endsWith('/') })
        // Stop early on an archive far past the limit instead of walking it all.
        if (entries.length > MAX_BUNDLE_FILES * 4) { zip.close(); return resolve(entries) }
        zip.readEntry()
      })
      zip.on('end', () => resolve(entries))
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

const listForMessage = (names: string[]) =>
  names.slice(0, 5).join(', ') + (names.length > 5 ? ` and ${names.length - 5} more` : '')

/**
 * Checks an archive against the bundle rules before anything is written:
 * safe paths, size and count limits, allowed file types, and an `index.html`
 * at the top level or inside the single folder the archive was made from.
 */
export async function planBundle(buffer: Buffer): Promise<BundlePlan> {
  const entries = await listEntries(buffer)
  const files: BundleEntry[] = []
  const refused: string[] = []
  let bytes = 0
  for (const entry of entries) {
    if (!safeEntryName(entry.name)) throw new Error('Bundle contains an unsafe path')
    const name = entry.name.replaceAll('\\', '/')
    if (entry.directory || isSystemJunk(name)) continue
    if (!bundleMimeType(name)) { refused.push(name); continue }
    files.push({ name, size: entry.size })
    bytes += entry.size
    if (files.length > MAX_BUNDLE_FILES) throw new Error(`Bundle contains too many files (the limit is ${MAX_BUNDLE_FILES})`)
    if (bytes > MAX_BUNDLE_UNPACKED_BYTES) throw new Error('Bundle exceeds the 100 MB unpacked size limit')
  }
  if (refused.length) {
    throw new Error(`This ZIP contains files that can't be published: ${listForMessage(refused)}. A bundle may only contain web files: HTML, CSS, JavaScript, JSON, images, fonts, audio, video, PDF and text.`)
  }

  // "Compress folder" puts every file under one top-level folder. Serve from
  // inside it so its index.html is the bundle's front page.
  const firstSegments = new Set(files.map(file => file.name.split('/')[0]))
  const [only] = firstSegments
  const root = firstSegments.size === 1 && files.every(file => file.name.includes('/')) ? `${only}/` : ''
  if (!files.some(file => file.name === `${root}index.html`)) {
    throw new Error('A ZIP bundle must be a static website with an index.html at its top level (or inside its one top-level folder). To share other files, upload them individually.')
  }
  return { files, root, bytes }
}

/**
 * Extracts a static bundle into the rangka storage under `prefix`, after
 * `planBundle` has accepted it. Junk files are skipped and the single
 * top-level folder, if any, is removed from every path.
 *
 * Entries are written one at a time, so a 100 MB unpacked archive does not
 * have to be held in memory all at once. The same keys work on the filesystem,
 * R2, and S3 because they go through Nitro's storage layer.
 */
export async function extractBundle(buffer: Buffer, prefix: string) {
  const plan = await planBundle(buffer)
  const wanted = new Set(plan.files.map(file => file.name))

  await new Promise<void>((resolve, reject) => {
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
      zip.on('entry', (entry) => {
        if (finished) return
        const name = entry.fileName.replaceAll('\\', '/')
        if (!wanted.has(name)) { zip.readEntry(); return }

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(streamError || new Error('Could not read bundle entry'))

          const chunks: Buffer[] = []
          stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
          stream.on('error', fail)
          stream.on('end', async () => {
            try {
              await writeRangka(`${prefix}/${name.slice(plan.root.length)}`, Buffer.concat(chunks))
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
          resolve()
        }
      })
      zip.on('error', fail)
    })
  })
  return { files: plan.files.length, bytes: plan.bytes }
}

/**
 * Reads a bundle file. Bundles uploaded before the top-level folder was
 * removed on extraction still keep it, so a miss retries inside that folder.
 */
export async function readBundleFile(prefix: string, path: string) {
  try {
    return await readRangkaBytes(`${prefix}/${path}`)
  } catch (error) {
    const storage = rangkaStorage()
    const base = `${prefix.replaceAll('/', ':')}:`
    const keys = (await storage.getKeys(prefix)).map(key => key.startsWith(base) ? key.slice(base.length) : key)
    const tops = new Set(keys.map(key => key.split(':')[0]).filter(top => top !== '__MACOSX'))
    const [only] = tops
    if (tops.size !== 1 || !keys.some(key => key === `${only}:index.html`)) throw error
    return await readRangkaBytes(`${prefix}/${only}/${path}`)
  }
}

export async function deleteBundle(prefix: string) {
  const storage = rangkaStorage()
  const keys = await storage.getKeys(prefix)
  await Promise.all(keys.map(key => storage.removeItem(key)))
}
