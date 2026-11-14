/** Fail closed on registry errors and only resume a matching manifest digest. */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function imageDigest(reference, run = execFileSync) {
  let value
  try {
    value = run('docker', ['buildx', 'imagetools', 'inspect', reference, '--format', '{{.Manifest.Digest}}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    if (/manifest unknown|manifest_unknown|name_unknown|not found|\b404\b/i.test(String(error.stderr))) return null
    throw error
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`Invalid manifest digest for ${reference}: ${value}`)
  return value
}

export function releaseImageState(image, version, staged, inspect = imageDigest) {
  const publishedDigest = inspect(`${image}:${version}`)
  const stagedDigest = inspect(staged)
  if (publishedDigest && publishedDigest !== stagedDigest) {
    throw new Error(`${version} already exists but was not built from this commit and candidate. Refusing to overwrite a published release.`)
  }
  return { state: publishedDigest ? 'promoted' : stagedDigest ? 'staged' : 'absent', digest: stagedDigest || '' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [image, version, staged] = process.argv.slice(2)
  if (!image || !version || !staged) throw new Error('Usage: release-image-state.mjs IMAGE VERSION STAGED_REFERENCE')
  const result = releaseImageState(image, version, staged)
  console.log(JSON.stringify(result))
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `state=${result.state}\ndigest=${result.digest}\n`)
  }
}
