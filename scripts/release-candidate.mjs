/** Persist the exact unpushed release commit across attempts of an Actions run. */
import { execFileSync } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

export async function releaseCandidate(mode, directory, source, platforms) {
  directory = resolve(directory)
  const file = join(directory, 'release.json')
  let candidate
  if (mode === 'restore') {
    candidate = JSON.parse(await readFile(file, 'utf8'))
    if (candidate.source !== source || candidate.platforms !== platforms) throw new Error('Saved release candidate does not match this run and platform selection')
    if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(candidate.tag) || candidate.tag !== `v${candidate.version}` || !/^[a-f0-9]{40}$/.test(candidate.commit)) throw new Error('Invalid saved release metadata')
    git('fetch', join(directory, 'release.bundle'), `refs/tags/${candidate.tag}:refs/tags/${candidate.tag}`)
    if (git('rev-parse', `${candidate.tag}^{commit}`) !== candidate.commit || git('rev-parse', `${candidate.commit}^`) !== source) throw new Error('Saved release commit does not match its source')
    git('checkout', '--detach', candidate.commit)
  } else if (mode === 'save') {
    const { version } = JSON.parse(await readFile('package.json', 'utf8'))
    const tag = `v${version}`
    if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag)) throw new Error('Invalid candidate version')
    git('add', 'package.json', 'CHANGELOG.md')
    git('commit', '-m', `chore(release): ${tag}`)
    git('tag', '-a', tag, '-m', tag)
    candidate = { version, tag, source, platforms, commit: git('rev-parse', 'HEAD') }
    const changelog = await readFile('CHANGELOG.md', 'utf8')
    const section = changelog.split(`## ${tag}\n`)[1]?.split(/\n## /)[0]?.trim()
    if (!section) throw new Error(`CHANGELOG.md has no section for ${tag}`)
    await mkdir(directory, { recursive: true })
    await writeFile(file, `${JSON.stringify(candidate, null, 2)}\n`)
    await writeFile(join(directory, 'release-notes.md'), `${section}\n`)
    // The checkout already contains the source; the bundle only needs its child.
    git('bundle', 'create', join(directory, 'release.bundle'), `refs/tags/${tag}`, `^${source}`)
  } else throw new Error('Expected save or restore')

  const suffix = platforms === 'linux/amd64' ? 'amd64' : 'multi'
  candidate.stage = `sha-${source}-${candidate.version}-${suffix}`
  if (candidate.stage.length > 128) throw new Error('Candidate staging tag exceeds Docker tag limit')
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(candidate).map(([key, value]) => `${key}=${value}\n`).join(''))
  }
  return candidate
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, directory] = process.argv.slice(2)
  await releaseCandidate(mode, directory, process.env.GITHUB_SHA, process.env.PLATFORMS)
}
