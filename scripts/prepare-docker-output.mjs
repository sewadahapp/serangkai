/** Prepare a portable, Bun-only deployment copy without changing tested output. */
import { cp, mkdir, readdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function assertPortableOutput(directory) {
  const root = await realpath(directory)
  async function walk(path) {
    const actual = await realpath(path)
    const rel = relative(root, actual)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Output symlink escapes deployment: ${path}`)
    if ((await stat(path)).isDirectory()) {
      for (const entry of await readdir(path)) await walk(join(path, entry))
      return
    }
    const bytes = await readFile(path)
    const magic = bytes.subarray(0, 4).toString('hex')
    if (/\.(node|so(?:\.\d+)*|dylib|dll|exe)$/i.test(path)
        || ['7f454c46', 'cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca'].includes(magic)
        || magic.startsWith('4d5a')) {
      throw new Error(`Native binary cannot be shared across Docker architectures: ${relative(root, path)}. Use target-native dependencies before publishing.`)
    }
  }
  await walk(root)
}

export async function prepareDockerOutput(source, destination, project = process.cwd()) {
  source = resolve(source)
  destination = resolve(destination)
  if (source === destination || !relative(source, destination).startsWith('..') || !relative(destination, source).startsWith('..')) {
    throw new Error('Docker output must be separate from the tested .output directory')
  }
  const nitro = JSON.parse(await readFile(join(source, 'nitro.json'), 'utf8'))
  if (nitro.preset !== 'node-server') throw new Error(`Docker requires node-server output, got ${nitro.preset}`)
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(source, join(destination, '.output'), { recursive: true })
  // server/db/index.ts chooses bun:sqlite under Bun. These prebuilds belong to
  // the unused Node fallback; leave the original output (and Node tests) intact.
  await rm(join(destination, '.output/server/node_modules/better-sqlite3/prebuilds'), { recursive: true, force: true })
  await rm(join(destination, '.output/server/node_modules/better-sqlite3/build'), { recursive: true, force: true })
  await mkdir(join(destination, 'scripts'))
  for (const file of ['start.mjs', 'session-secret.mjs']) {
    await cp(join(project, 'scripts', file), join(destination, 'scripts', file))
  }
  await assertPortableOutput(destination)
  console.log(`Prepared portable Bun deployment at ${destination}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source, destination] = process.argv.slice(2)
  if (!source || !destination) throw new Error('Usage: bun scripts/prepare-docker-output.mjs .output <destination>')
  await prepareDockerOutput(source, destination)
}
