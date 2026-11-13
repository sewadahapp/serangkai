import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRangkaTokenCss } from '../shared/selaras-tokens'

/**
 * Builds the trusted bundles and opt-in document theme for sandboxed HTML
 * rangka.
 *
 * Bun's native bundler keeps the toolchain Bun-only. Runtime bundles are
 * classic IIFEs because a sandboxed frame has an opaque origin and module
 * imports would require CORS. Each bundle is loaded only when its marker is
 * present.
 *
 * The document theme is generated from Selaras' own prose CSS so Serangkai
 * does not maintain a second typography implementation.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const runtimeDir = join(root, 'public', 'runtime')
const themeDir = join(root, 'public', 'rangka-themes')

await rm(runtimeDir, { recursive: true, force: true })
await rm(themeDir, { recursive: true, force: true })
await mkdir(runtimeDir, { recursive: true })
await mkdir(themeDir, { recursive: true })

const result = await Bun.build({
  entrypoints: [join(root, 'runtime', 'charts.ts'), join(root, 'runtime', 'mermaid.ts')],
  outdir: runtimeDir,
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

const selarasProse = await readFile(join(root, 'node_modules', '@sewadah', 'selaras', 'dist', 'runtime', 'prose.css'), 'utf8')
const proseForBody = selarasProse
  .replaceAll('.selaras-prose', 'body')
  .replaceAll('--selaras-prose-font-body:inherit', '--selaras-prose-font-body:var(--serangkai-doc-font)')
  .replaceAll('--selaras-prose-font-heading:inherit', '--selaras-prose-font-heading:var(--serangkai-doc-font)')

const theme = `/*
 * Serangkai document theme for opt-in HTML rangka.
 * Generated from @sewadah/selaras prose CSS. Do not edit by hand.
 */
@font-face {
  font-family: "Plus Jakarta Sans";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("/fonts/plus-jakarta-sans-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
    U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215,
    U+FEFF, U+FFFD;
}

:root {
  --serangkai-doc-font: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --serangkai-doc-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --selaras-prose-font-mono: var(--serangkai-doc-mono);
}

/* Selaras design tokens, generated from shared/selaras-tokens.ts so the MCP
   token reference and this stylesheet can never drift apart. The resolved
   wrappers follow the viewer's active theme and light/dark mode. */
${buildRangkaTokenCss()}

html {
  color-scheme: light dark;
  background: var(--selaras-resolved-surface-canvas);
}

body {
  max-width: 48rem;
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 4vw, 2rem) 5rem;
  background: var(--selaras-resolved-surface-canvas);
  color: var(--selaras-resolved-text-default);
  font-family: var(--serangkai-doc-font);
  line-height: 1.75;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after { box-sizing: border-box; }
body > :first-child { margin-block-start: 0; }
body > :last-child { margin-block-end: 0; }

${proseForBody}

/* Selaras prose sets these through tokens; make code and tables match the
   standalone document surface without touching arbitrary author CSS. */
body :where(pre) {
  border: 1px solid var(--selaras-resolved-border-default);
  overflow-x: auto;
}
body :where(table) {
  border: 1px solid var(--selaras-resolved-border-default);
  border-radius: var(--selaras-resolved-radius-md);
}
body :where(thead) {
  border-bottom: 1px solid var(--selaras-resolved-border-default);
}
body :where(blockquote) {
  margin-inline: 0;
  padding-block: .25rem;
}
body :where(img, video, svg) {
  height: auto;
  max-width: 100%;
}
body :where(hr) {
  margin-block: 2.5rem;
}
body :where(input[type="checkbox"]) {
  accent-color: var(--selaras-resolved-color-primary-text);
  margin-inline-end: .5rem;
}
`

await writeFile(join(themeDir, 'selaras-document.css'), theme)
console.log(`${join(themeDir, 'selaras-document.css')} ${theme.length} bytes`)
