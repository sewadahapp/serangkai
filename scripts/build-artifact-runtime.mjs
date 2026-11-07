import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * Builds the trusted bundles injected into sandboxed HTML artifacts.
 *
 * They are served as classic same-origin scripts, not ES modules: a sandboxed
 * frame has an opaque origin, and module scripts would require CORS on every
 * import. Each bundle is self-contained and only loaded when its marker is
 * present in the artifact.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outdir = join(root, 'public', 'runtime')
const shared = {
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  legalComments: 'eof',
  logLevel: 'warning',
}

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

await Promise.all([
  build({
    ...shared,
    entryPoints: [join(root, 'runtime', 'charts.ts')],
    outfile: join(outdir, 'charts.js'),
  }),
  build({
    ...shared,
    entryPoints: [join(root, 'runtime', 'mermaid.ts')],
    outfile: join(outdir, 'mermaid.js'),
  }),
])
