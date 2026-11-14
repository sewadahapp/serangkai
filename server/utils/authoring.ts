import { rangkaComponents, applicationOnlyComponents, componentCatalogMarkdown } from '../../shared/rangka-components'
import { ALL_SELARAS_TOKENS } from '../../shared/selaras-tokens'
import { themes } from '../../shared/themes'

/**
 * Authoring guidance exposed to MCP clients.
 *
 * Kept next to the component registry so discovery cannot drift from the
 * renderer. `get_rangka_capabilities` is the compact entry point; the longer
 * guides are exposed as MCP resources.
 */

export const authoringRangkaTypes = [
  { type: 'markdown', description: 'Comark Markdown with Selaras components, Mermaid, TanStack Charts, and syntax-highlighted code.' },
  { type: 'html', description: 'Standalone HTML. Self-styled by default; opt into the Selaras document theme with a meta tag.' },
  { type: 'javascript', description: 'Standalone JavaScript source, displayed with syntax highlighting. No server execution.' },
  { type: 'json', description: 'JSON source, displayed with syntax highlighting.' },
  { type: 'image', description: 'SVG markup as text content (create_rangka or POST /api/rangka). Raster images (PNG, JPEG, WebP, GIF) must be uploaded with POST /api/rangka/upload.' },
  { type: 'pdf', description: 'PDF viewed in the browser. Binary: upload with POST /api/rangka/upload; not accepted as text content.' },
  { type: 'bundle', description: 'Static ZIP web application, served sandboxed with authorization. Binary: upload the .zip with POST /api/rangka/upload; not accepted as text content.' },
]

export const chartSchema = {
  type: ['bar', 'line', 'area'],
  horizontal: 'boolean (bar only)',
  data: 'array of objects',
  x: 'category key (optional; inferred)',
  y: 'numeric key (optional; inferred)',
  title: 'string (optional)',
  xLabel: 'string (optional)',
  yLabel: 'string (optional)',
  color: 'CSS color (optional)',
  height: 'number (optional, default 320)',
}

export const capabilities = {
  version: 1,
  rangkaTypes: authoringRangkaTypes,
  markdown: {
    engine: 'Comark',
    styling: 'Selaras prose by default',
    syntax: 'CommonMark + GFM + Comark components + attributes',
    components: rangkaComponents.map(component => component.tag),
    applicationOnlyComponents: Object.keys(applicationOnlyComponents),
    charts: chartSchema,
    mermaid: 'Fenced ```mermaid blocks and ::mermaid components',
  },
  html: {
    defaultStyling: 'self-styled; no automatic Selaras or Tailwind injection',
    documentTheme: 'opt in with <meta name="serangkai-theme" content="selaras-document">',
    designTokens: {
      contract: 'var(--selaras-resolved-<token>)',
      follows: `the viewer's active theme (${themes.map(theme => theme.id).join(' | ')}) and light/dark mode`,
      reference: 'serangkai://tokens/selaras',
      tokens: ALL_SELARAS_TOKENS.map(token => token.name),
    },
    security: 'sandboxed iframe, connect-src none, no CDN or arbitrary remote scripts',
  },
  authoring: {
    preferMarkdown: 'reports, documentation, and mixed narrative + data',
    preferHtml: 'custom dashboards, prototypes, and standalone applications',
    preferBundle: 'prebuilt frontend applications',
  },
}

export function capabilitiesText() {
  return JSON.stringify(capabilities, null, 2)
}

export const markdownGuide = `# Markdown authoring guide (Comark + Selaras)

Serangkai stores your Markdown source and renders it with Comark. Ordinary
Markdown already looks polished through Selaras prose styling.

## Start with ordinary Markdown

- Headings, paragraphs, links, bold, italic, blockquotes, lists, tables,
  inline code, fenced code, and images all work.
- Heading levels h2–h4 become the table of contents.
- Tables are responsive; wide tables scroll rather than break the page.
- GFM task lists render as disabled checkboxes. They are a visual checklist,
  not a form.

## Code blocks

Use fenced code with a language:

\`\`\`ts
const answer: number = 42
\`\`\`

Shiki highlights common languages with light and dark themes. A copy button is
built in.

## Mermaid

\`\`\`mermaid
flowchart LR
  Draft --> Review --> Share
\`\`\`

Also supported:

::mermaid
sequenceDiagram
  Agent->>Serangkai: create_rangka
  Serangkai-->>Agent: version
::

## Charts

Serangkai's declarative chart schema supports bar, line, area, and horizontal
bar charts. Do not write TanStack Charts code; provide JSON:

\`\`\`chart
{"type":"bar","title":"Rangka per week","data":[{"week":"W1","value":6},{"week":"W2","value":12}],"x":"week","y":"value"}
\`\`\`

Supported keys: type, data, x, y, title, xLabel, yLabel, horizontal (bar only),
color, and height.

## Selaras components

Use block components for structure and inline components for accents:

::s-alert{title="Heads up" color="info"}
Markdown works **inside** components.
::

::s-card{variant="soft"}
#header
### Release notes

#default
Everything in this release, in one place.
::

::s-table{data='[{"name":"Ada","role":"Admin"},{"name":"Lin","role":"Member"}]' columns='[{"field":"name","header":"Name"},{"field":"role","header":"Role"}]' striped}
::

Use \`::s-tabs\`, \`::s-accordion\`, and \`::s-collapsible\` for local navigation.
Use \`default-value\` for initial state. Do not use v-model or event handlers.

## Security limits

- Scripts, iframes, event handlers, author styles, expressions, and unknown
  components are removed.
- Only approved Selaras components and properties render.
- Forms, overlays, application navigation, and other components that need
  application state are not available in Markdown.
- Links may use http, https, and mailto. Images may not use data: URLs.
`

export const htmlGuide = `# HTML rangka authoring guide

HTML rangka are standalone documents. They are self-styled by default:
Serangkai does not inject Selaras, Tailwind, or global component CSS.

## Design independence

Use your own CSS and layout for dashboards, prototypes, and applications. The
rangka runs in a sandboxed iframe with no network access.

## Optional Selaras document theme

For a report or documentation page, opt in to the Serangkai document theme:

\`\`\`html
<head>
  <meta name="serangkai-theme" content="selaras-document">
</head>
\`\`\`

This adds polished prose typography, spacing, tables, code blocks, and light/dark
colors. It does not inject Vue or make Selaras components available. If you need
actual Selaras components, build a Vue application and upload it as a bundle.

## Design tokens (match the active theme)

With the document theme opted in, style with the resolved Selaras tokens instead
of hard-coded colors. They resolve against the viewer's active theme and
light/dark mode, so the same HTML looks native everywhere:

\`\`\`html
<style>
  .card {
    background: var(--selaras-resolved-surface-default);
    color: var(--selaras-resolved-text-default);
    border: 1px solid var(--selaras-resolved-border-default);
    border-radius: var(--selaras-resolved-radius-md);
  }
  .card a { color: var(--selaras-resolved-color-primary-text); }
  .badge {
    background: var(--selaras-resolved-color-accent-subtle);
    color: var(--selaras-resolved-color-accent-on-subtle);
  }
</style>
\`\`\`

Read the \`serangkai://tokens/selaras\` resource for the full token table
(surfaces, text, borders, primary/accent/secondary, radius, elevation). Always
use the \`--selaras-resolved-*\` wrapper; never import Selaras CSS or a CDN.

## Charts and Mermaid

The same declarative markers work inside HTML:

\`\`\`html
<pre class="mermaid">flowchart LR
  Draft --> Review --> Share
</pre>

<script type="application/json" data-serangkai-chart>
{"type":"bar","data":[{"week":"W1","value":12}],"x":"week","y":"value"}
</script>
\`\`\`

No CDN, package install, or chart initialization code is needed.

## Color mode

Use \`color-scheme: light dark\` and \`light-dark()\`. Serangkai posts the live
workspace mode into the frame. To pin one scheme:

\`\`\`html
<meta name="color-scheme" content="only light">
\`\`\`

## Security

- The frame is sandboxed and cannot reach the app origin.
- \`connect-src 'none'\` blocks network calls.
- Inline scripts are allowed, but Serangkai does not execute your JavaScript on
  the server.
- Keep the page self-contained; use data URLs for images or inline SVG.
`

export const templates = {
  report: `# Quarterly review

## Highlights

- Revenue grew **18%** quarter over quarter.
- Median response time fell to **160 ms**.

| Metric | Q1 | Q2 |
| --- | --- | --- |
| Revenue | $1.2M | $1.4M |
| Churn | 3.1% | 2.4% |

::s-callout{type="tip" title="What changed"}
The new onboarding flow removed two steps from activation.
::

\`\`\`chart
{"type":"line","title":"Revenue","data":[{"quarter":"Q1","value":1.2},{"quarter":"Q2","value":1.4}],"x":"quarter","y":"value"}
\`\`\`
`,
  technicalDoc: `# Deployment guide

## Prerequisites

- Bun 1.4+ (Docker image ships it) or a Cloudflare account for Workers.
- Docker: a persistent volume mounted at \`/data\`.
- Workers: a D1 database plus R2 (default) or a private Backblaze B2 bucket.

## Required configuration

Set \`ADMIN_USERNAME\`, \`ADMIN_PASSWORD\`, \`JWT_SECRET\`, and \`SHARE_SECRET\`.
There is no sign-up: the single owner comes from the environment. On Workers
also set \`NUXT_APP_SECRET\` (the session key cannot be derived at the edge).

## Docker

\`\`\`bash
docker run -d -p 3000:3000 \\
  -v serangkai-data:/data \\
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='choose-a-strong-password' \\
  -e JWT_SECRET="$(openssl rand -base64 32)" -e SHARE_SECRET="$(openssl rand -base64 32)" \\
  ghcr.io/sewadahapp/serangkai:latest
\`\`\`

SQLite and uploaded files live under \`/data\`; the volume is the whole
persistence story.

## Cloudflare Workers

Use the Deploy to Cloudflare button (D1 + R2) or the B2 template (D1 + B2).
The Worker creates its D1 schema on first request; object storage is R2 or B2,
not a filesystem volume.

::s-alert{title="Secrets" color="warning"}
Use stable random secrets. Rotating \`JWT_SECRET\` signs everyone out; rotating
\`SHARE_SECRET\` invalidates existing unlisted links.
::
`,
  dashboard: `# Workspace activity

::s-card-group{cols="3"}
  ::s-card
  ### Rangka
  **42**
  ::
  ::s-card
  ### Readers
  **1.2k**
  ::
  ::s-card
  ### Availability
  **99.9%**
  ::
::

\`\`\`chart
{"type":"bar","title":"Rangka per week","data":[{"week":"W1","value":6},{"week":"W2","value":12},{"week":"W3","value":18}],"x":"week","y":"value"}
\`\`\`

\`\`\`mermaid
flowchart LR
  Draft --> Review --> Share
\`\`\`
`,
  diagram: `# Release flow

\`\`\`mermaid
flowchart LR
  Idea --> Draft
  Draft --> Review
  Review -->|approved| Publish
  Review -->|changes| Draft
  Publish --> Share
\`\`\`

## Ownership

| Stage | Owner |
| --- | --- |
| Draft | Author |
| Review | Editor |
| Share | Workspace |
`,
  interactiveApp: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Custom dashboard</title>
  <style>
    body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; background: light-dark(#f8fafc, #0b1020); color: light-dark(#0f172a, #e2e8f0); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .card { border: 1px solid light-dark(#dbe3ee, #263349); border-radius: 1rem; padding: 1rem; }
  </style>
</head>
<body>
  <h1>Custom dashboard</h1>
  <div class="cards">
    <div class="card"><strong>42</strong><br>rangka</div>
    <div class="card"><strong>18 ms</strong><br>preview</div>
  </div>
</body>
</html>
`,
}

export const promptMessages = {
  createReport: 'Create a polished Markdown report using Serangkai authoring capabilities. Include headings, a table, a chart, and one Selaras callout. Keep the source portable.',
  createDashboard: 'Create a Markdown dashboard using Selaras cards and a TanStack chart. Use the declarative chart schema; do not write chart JavaScript.',
  createHtmlDocument: 'Create a styled HTML report using the opt-in Selaras document theme. Keep it self-contained and include one Mermaid diagram.',
  createCustomDashboard: 'Create a custom-designed HTML dashboard with your own CSS. Do not use the Selaras document theme. Include one chart marker.',
}
