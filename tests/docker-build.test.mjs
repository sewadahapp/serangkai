import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { prepareDockerOutput, assertPortableOutput } from '../scripts/prepare-docker-output.mjs'
import { imageDigest, releaseImageState } from '../scripts/release-image-state.mjs'
import { platformImage } from '../scripts/docker-platform-image.mjs'

const root = new URL('../', import.meta.url)
const digest = `sha256:${'a'.repeat(64)}`
const other = `sha256:${'b'.repeat(64)}`
const armDigest = `sha256:${'c'.repeat(64)}`
const imageType = 'application/vnd.oci.image.manifest.v1+json'
const stagedImage = `example.test/serangkai@${digest}`
const imageIndex = {
  schemaVersion: 2,
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    { mediaType: imageType, digest: other, platform: { os: 'linux', architecture: 'amd64' } },
    { mediaType: imageType, digest: armDigest, platform: { os: 'linux', architecture: 'arm64', variant: 'v8' } },
    { mediaType: imageType, digest, platform: { os: 'unknown', architecture: 'unknown' }, annotations: { 'vnd.docker.reference.type': 'attestation-manifest' } },
  ],
}

test('smoke pulls use distinct platform manifests belonging to the pinned promotion index', () => {
  assert.equal(platformImage(stagedImage, 'linux/amd64', imageIndex), `example.test/serangkai@${other}`)
  assert.equal(platformImage(stagedImage, 'linux/arm64', imageIndex), `example.test/serangkai@${armDigest}`)
  assert.equal(platformImage(stagedImage, 'linux/arm64/v8', imageIndex), `example.test/serangkai@${armDigest}`)
  assert.throws(() => platformImage(stagedImage, 'linux/arm/v7', imageIndex), /found 0/)
  assert.throws(() => platformImage(stagedImage, 'linux/amd64', { ...imageIndex, manifests: [...imageIndex.manifests, imageIndex.manifests[0]] }), /found 2/)
  assert.throws(() => platformImage(stagedImage, 'linux/amd64', { ...imageIndex, manifests: [{ ...imageIndex.manifests[0], digest: 'invalid' }] }), /Invalid manifest digest/)
  assert.throws(() => platformImage('example.test/serangkai:mutable', 'linux/amd64', imageIndex), /pinned/)
  assert.equal(platformImage(stagedImage, 'linux/amd64', { schemaVersion: 2, mediaType: imageType }), stagedImage)
})

test('smoke orchestration avoids classic-store index collisions and preserves loaded local tags', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'serangkai-smoke-regression-'))
  try {
    const bin = join(directory, 'bin')
    const calls = join(directory, 'calls.jsonl')
    const state = join(directory, 'images.json')
    const fixture = join(directory, 'index.json')
    await mkdir(bin)
    await writeFile(fixture, JSON.stringify(imageIndex))
    // Reproduce the classic store's failure if the shared INDEX digest is
    // passed to pull/run. Real container behavior is checked separately.
    await writeFile(join(bin, 'docker'), `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
appendFileSync(process.env.SMOKE_CALLS, JSON.stringify(args) + '\\n')
const images = JSON.parse(readFileSync(process.env.SMOKE_IMAGES, 'utf8'))
const pinned = ${JSON.stringify(stagedImage)}
const ref = args.find(arg => arg.startsWith('example.test/') || arg.startsWith('local:'))
if (args[0] === 'buildx') { console.log(readFileSync(process.env.SMOKE_INDEX, 'utf8')); process.exit(0) }
if (['pull', 'run'].includes(args[0]) && ref === pinned) { console.error('cannot overwrite digest ' + ${JSON.stringify(digest)}); process.exit(1) }
if (args[0] === 'image') process.exit(ref.startsWith('local:') || images.includes(ref) ? 0 : 1)
if (args[0] === 'pull') { images.push(ref); writeFileSync(process.env.SMOKE_IMAGES, JSON.stringify(images)); process.exit(0) }
if (args[0] === 'port') console.log('127.0.0.1:3999')
if (args[0] === 'inspect') console.log('true')
if (args[0] === 'run') console.log(args.includes('--entrypoint') ? (args[args.indexOf('--platform') + 1] === 'linux/amd64' ? 'x64' : 'arm64') : 'container-id')
`)
    await writeFile(join(bin, 'curl'), `#!${process.execPath}
console.log(JSON.stringify({ rangka: [{ title: 'Docker SQLite smoke' }, { title: 'Docker storage smoke' }] }))
`)
    for (const command of ['docker', 'curl']) await chmod(join(bin, command), 0o755)
    const script = new URL('../scripts/smoke-docker.sh', import.meta.url).pathname
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SMOKE_CALLS: calls, SMOKE_IMAGES: state, SMOKE_INDEX: fixture, GITHUB_STEP_SUMMARY: '' }
    await writeFile(state, '[]')
    execFileSync('bash', [script, stagedImage, 'linux/amd64,linux/arm64'], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
    const commands = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    const pulls = commands.filter(args => args[0] === 'pull')
    assert.deepEqual(pulls.map(args => args.at(-1)), [`example.test/serangkai@${other}`, `example.test/serangkai@${armDigest}`])
    assert.equal(commands.filter(args => args[0] === 'buildx').length, 1)
    assert.equal(commands.filter(args => args[0] === 'run').length, 6, 'both architectures must probe and boot twice')
    assert.ok(commands.filter(args => args[0] === 'run').every(args => args.includes('--pull=never')))
    assert.ok(commands.filter(args => args[0] === 'image').every(args => !args.includes('--platform')), 'works with older classic-store Docker APIs')
    await writeFile(calls, '')
    execFileSync('bash', [script, 'local:rehearsal-arm64', 'linux/arm64'], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
    const local = (await readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    assert.ok(local.every(args => !['buildx', 'pull'].includes(args[0])), 'loaded rehearsal/PR tags need no registry access')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('Docker packaging removes only unused SQLite bindings and preserves tested Node output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'serangkai-portable-'))
  try {
    const source = join(directory, '.output')
    const destination = join(directory, 'docker-app')
    const prebuild = 'server/node_modules/better-sqlite3/prebuilds/linux-x64.node'
    await mkdir(join(source, 'server/node_modules/better-sqlite3/prebuilds'), { recursive: true })
    await writeFile(join(source, 'nitro.json'), JSON.stringify({ preset: 'node-server' }))
    await writeFile(join(source, prebuild), Buffer.from('7f454c46', 'hex'))
    await writeFile(join(source, 'server/index.mjs'), 'console.log("portable")')
    await prepareDockerOutput(source, destination, new URL('..', import.meta.url).pathname)
    assert.equal((await readFile(join(source, prebuild))).toString('hex'), '7f454c46')
    await assert.rejects(readFile(join(destination, '.output', prebuild)), /ENOENT/)
    assert.match(await readFile(join(destination, 'scripts/start.mjs'), 'utf8'), /deriveSessionSecret/)
    await assertPortableOutput(destination)
    await assert.rejects(prepareDockerOutput(source, source), /separate/)
    await assert.rejects(prepareDockerOutput(source, directory), /separate/)
    await writeFile(join(source, 'nitro.json'), JSON.stringify({ preset: 'cloudflare_module' }))
    await assert.rejects(prepareDockerOutput(source, destination), /node-server/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('portable output rejects unexpected native addons, executables, and escaping symlinks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'serangkai-native-'))
  try {
    for (const [name, bytes] of [['addon.node', 'text'], ['executable', Buffer.from('7f454c460000', 'hex')], ['library', Buffer.from('cffaedfe0000', 'hex')]]) {
      await writeFile(join(directory, name), bytes)
      await assert.rejects(assertPortableOutput(directory), /Native binary/)
      await rm(join(directory, name))
    }
    await symlink('/etc/hosts', join(directory, 'escape'))
    await assert.rejects(assertPortableOutput(directory), /symlink escapes/)
    await rm(join(directory, 'escape'))
    await writeFile(join(directory, 'runtime.wasm'), Buffer.from('0061736d01000000', 'hex'))
    await assertPortableOutput(directory)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('release recovery requires matching digests, never merely a staging tag', () => {
  assert.deepEqual(releaseImageState('image', '1.0.0', 'stage', () => null), { state: 'absent', digest: '' })
  assert.deepEqual(releaseImageState('image', '1.0.0', 'stage', ref => ref === 'stage' ? digest : null), { state: 'staged', digest })
  assert.deepEqual(releaseImageState('image', '1.0.0', 'stage', () => digest), { state: 'promoted', digest })
  assert.throws(() => releaseImageState('image', '1.0.0', 'stage', ref => ref === 'stage' ? other : digest), /Refusing to overwrite/)
  assert.throws(() => releaseImageState('image', '1.0.0', 'stage', ref => ref === 'stage' ? null : digest), /Refusing to overwrite/)
  assert.equal(imageDigest('image', () => `${digest}\n`), digest)
  assert.equal(imageDigest('image', () => { throw Object.assign(new Error('missing'), { stderr: 'manifest unknown' }) }), null)
  for (const stderr of ['unauthorized', 'TLS handshake timeout', 'connection refused']) {
    assert.throws(() => imageDigest('image', () => { throw Object.assign(new Error(stderr), { stderr }) }), new RegExp(stderr))
  }
  assert.throws(() => imageDigest('image', () => 'invalid'), /Invalid manifest digest/)
})

test('a saved release restores the exact commit after publication and refuses mismatched inputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'serangkai-release-candidate-'))
  const repo = join(directory, 'repo')
  const saved = join(directory, 'saved')
  try {
    await mkdir(repo)
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git('init', '-b', 'main')
    git('config', 'user.name', 'Release test')
    git('config', 'user.email', 'release@example.invalid')
    await writeFile(join(repo, 'package.json'), '{"version":"0.0.1"}\n')
    await writeFile(join(repo, 'CHANGELOG.md'), '# Changelog\n')
    git('add', '.')
    git('commit', '-m', 'initial')
    const source = git('rev-parse', 'HEAD')
    await writeFile(join(repo, 'package.json'), '{"version":"0.0.2"}\n')
    await writeFile(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## v0.0.2\n\n- Fixed build\n\n## v0.0.1\n\nOld\n')
    const script = new URL('../scripts/release-candidate.mjs', import.meta.url).pathname
    const run = (mode, platforms = 'linux/amd64,linux/arm64') => execFileSync('bun', [script, mode, saved], { cwd: repo, env: { ...process.env, GITHUB_SHA: source, GITHUB_OUTPUT: '', PLATFORMS: platforms }, stdio: ['ignore', 'pipe', 'pipe'] })
    run('save')
    const candidate = JSON.parse(await readFile(join(saved, 'release.json'), 'utf8'))
    const commit = git('rev-parse', 'HEAD')
    assert.equal(candidate.commit, commit)
    assert.equal((await readFile(join(saved, 'release-notes.md'), 'utf8')).trim(), '- Fixed build')
    // Simulate checkout on a retry, with the now-published tag already fetched.
    git('checkout', '--detach', source)
    run('restore')
    assert.equal(git('rev-parse', 'HEAD'), commit)
    assert.equal(JSON.parse(await readFile(join(repo, 'package.json'), 'utf8')).version, '0.0.2')
    run('restore')
    assert.throws(() => run('restore', 'linux/amd64'), /Command failed/)
    // Also restore from only the original source, before a tag was pushed.
    git('checkout', '--detach', source)
    git('tag', '-d', 'v0.0.2')
    run('restore')
    assert.equal(git('rev-parse', 'HEAD'), commit)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('all image paths compile natively once and bound both runtime checks with an AMD64 fallback', async () => {
  const dockerfile = await readFile(new URL('Dockerfile', root), 'utf8')
  assert.match(dockerfile, /FROM --platform=\$BUILDPLATFORM oven\/bun:1\.4\.0@sha256:/)
  assert.doesNotMatch(dockerfile.split('AS runtime')[1], /^RUN /m)
  assert.match(dockerfile, /AS prebuilt/)
  for (const name of ['release.yml', 'docker.yml', 'release-rehearsal.yml']) {
    const text = await readFile(new URL(`.github/workflows/${name}`, root), 'utf8')
    const workflow = Bun.YAML.parse(text)
    assert.deepEqual(workflow.on.workflow_dispatch.inputs.platforms.options, ['linux/amd64,linux/arm64', 'linux/amd64'])
    const steps = Object.values(workflow.jobs)[0].steps
    const builds = steps.filter(step => step.uses === 'docker/build-push-action@v6')
    assert.ok(steps.findIndex(step => step.uses === 'docker/setup-qemu-action@v3') > steps.findLastIndex(step => step.uses === 'docker/build-push-action@v6'))
    assert.ok(builds.every(step => step['timeout-minutes'] <= 15 && /scope=serangkai-/.test(step.with['cache-from'])))
    if (name !== 'docker.yml') {
      assert.equal(steps.filter(step => step.run?.includes('bun run test:ci')).length, 1)
      assert.ok(builds.every(step => step.with.target === 'prebuilt' && step.with['build-contexts'].startsWith('app=')))
    }
    assert.match(text, /timeout (180|360) bash scripts\/smoke-docker\.sh/)
  }
})
