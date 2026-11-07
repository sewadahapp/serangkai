import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Builds the trusted bundles injected into sandboxed HTML artifacts.
 *
 * Bun's native bundler keeps the toolchain Bun-only. The bundles are classic
 * IIFEs because a sandboxed frame has an opaque origin and module imports would
 * require CORS. Each bundle is self-contained and loaded only when its marker
 * is present.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outdir = join(root, 'public', 'runtime')

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const result = await Bun.build({
  entrypoints: [join(root, 'runtime', 'charts.ts'), join(root, 'runtime', 'mermaid.ts')],
  outdir,
  format: 'iife',
  target: 'browser',
  minify: true,
  naming: '[name].js',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

for (const output of result.outputs) {
  console.log(`${output.path} ${output.size} bytes`)
}
