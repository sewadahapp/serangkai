/** Resolve a target manifest within the immutable index used for promotion. */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const imageManifestTypes = new Set([
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
])

export function platformImage(image, platform, manifest) {
  if (!/@sha256:[a-f0-9]{64}$/.test(image)) throw new Error('Expected a pinned sha256 image reference')
  if (manifest.schemaVersion !== 2) throw new Error('Expected a schema v2 Docker/OCI manifest')
  // Single-platform remote images already have a distinct immutable reference.
  // The smoke test's process.arch assertion still verifies the requested CPU.
  if (!Array.isArray(manifest.manifests)) {
    if (!imageManifestTypes.has(manifest.mediaType)) throw new Error('Expected an image manifest or multi-platform index')
    return image
  }
  const [os, architecture, variant] = platform.split('/')
  const matches = manifest.manifests.filter(entry => (
    entry.platform?.os === os
    && entry.platform?.architecture === architecture
    && (variant ? entry.platform?.variant === variant : !entry.platform?.variant || (architecture === 'arm64' && entry.platform.variant === 'v8'))
    && entry.annotations?.['vnd.docker.reference.type'] !== 'attestation-manifest'
    && imageManifestTypes.has(entry.mediaType)
  ))
  if (matches.length !== 1) throw new Error(`Expected exactly one runnable ${platform} manifest in ${image}; found ${matches.length}`)
  const digest = matches[0].digest
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid manifest digest for ${platform}`)
  return `${image.slice(0, image.lastIndexOf('@'))}@${digest}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [image, platform, file] = process.argv.slice(2)
  if (!image || !platform || !file) throw new Error('Usage: docker-platform-image.mjs IMAGE PLATFORM MANIFEST_JSON')
  console.log(platformImage(image, platform, JSON.parse(await readFile(file, 'utf8'))))
}
