/**
 * Guard an explicit release version before changelogen runs.
 *
 * `changelogen --release -r <version>` will happily accept a version *lower*
 * than the current one: it reports "Bumping ... from 0.1.0 to 0.0.9" and tags
 * it. Nothing downstream catches that, so the release workflow would publish an
 * image that sorts before its predecessor. This rejects it up front, along with
 * malformed versions and versions whose tag already exists.
 *
 * Exists as a script rather than a shell one-liner so it can be tested without
 * running a release.
 *
 * Usage: node scripts/check-release-version.mjs <version>
 * Writes `version` and `tag` to $GITHUB_OUTPUT when running in Actions.
 */
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z][0-9A-Za-z.-]*))?$/

export function parseVersion(value) {
  const match = SEMVER.exec(String(value ?? '').trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  }
}

function compareIdentifier(a, b) {
  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)
  // Numeric identifiers always have lower precedence than alphanumeric ones.
  if (aNumeric && bNumeric) return Number(a) - Number(b)
  if (aNumeric) return -1
  if (bNumeric) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Standard semver precedence. Returns -1, 0, or 1. */
export function compareVersions(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  // A release outranks any prerelease of the same version.
  if (!a.prerelease.length && !b.prerelease.length) return 0
  if (!a.prerelease.length) return 1
  if (!b.prerelease.length) return -1

  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    if (a.prerelease[index] === undefined) return -1
    if (b.prerelease[index] === undefined) return 1
    const result = compareIdentifier(a.prerelease[index], b.prerelease[index])
    if (result !== 0) return result
  }
  return 0
}

export function tagExists(tag, run = execFileSync) {
  try {
    run('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const verifyResult = args.includes('--verify-result')
  const requested = args.find(arg => !arg.startsWith('--'))
  if (!requested) {
    console.error('Usage: node scripts/check-release-version.mjs <version> [--verify-result]')
    process.exit(2)
  }

  const next = parseVersion(requested)
  if (!next) {
    console.error(`"${requested}" is not a valid version. Use MAJOR.MINOR.PATCH, optionally with a prerelease suffix.`)
    process.exit(1)
  }

  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const current = parseVersion(pkg.version)
  if (!current) {
    console.error(`package.json has no valid version (found "${pkg.version}").`)
    process.exit(1)
  }

  // With --verify-result the bump has already been applied, so package.json
  // equals the new version; only validity and tag availability remain to check.
  if (!verifyResult && compareVersions(next, current) <= 0) {
    console.error(`Version must advance: package.json is at ${pkg.version}, but ${requested} was requested.`)
    process.exit(1)
  }

  const tag = `v${requested}`
  if (tagExists(tag)) {
    console.error(`Tag ${tag} already exists. Pick a higher version.`)
    process.exit(1)
  }

  console.log(`${verifyResult ? 'Verified' : 'Releasing'} ${pkg.version} -> ${requested} (${tag})`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `version=${requested}\ntag=${tag}\n`)
  }
}

// Only run when invoked directly, so the helpers stay importable from tests.
const invokedDirectly = process.argv[1]
  && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
if (invokedDirectly) {
  await main()
}
