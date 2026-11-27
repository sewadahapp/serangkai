import { rangkaComponents, applicationOnlyComponents, componentCatalogMarkdown } from '../../shared/rangka-components'
import { ALL_SELARAS_TOKENS } from '../../shared/selaras-tokens'
import { themes } from '../../shared/themes'
import { MAX_CANVAS_DIMENSION, MIN_CANVAS_DIMENSION } from '../../shared/rangka-canvas'

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
  { type: 'bundle', description: 'Static website as a ZIP, served sandboxed with authorization. Needs an index.html at the top level or inside one top-level folder, and may only contain web files (HTML, CSS, JS, JSON, images, fonts, audio, video, PDF, text); anything else refuses the upload. Binary: upload the .zip with POST /api/rangka/upload; not accepted as text content.' },
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
  version: 2,
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
    // Live data an interactive rangka keeps without publishing a new version.
    data: {
      api: 'window.serangkai.data: info(), list(collection), get(collection, id), set(collection, id, object), update(collection, id, fields), remove(collection, id); every call returns a promise',
      model: 'JSON object documents in named collections, scoped to this rangka. Names: 1-64 letters, digits, "-" or "_".',
      behavior: 'Writes save immediately and survive reloads. They are not versions: restoring an older version keeps the data. The owner can write in the workspace; shared pages can read but not write (info().writable is false); opened outside Serangkai every call rejects.',
      limits: '64 KB per document, 5000 documents and 5 MB per rangka; data counts toward storage usage',
      agents: 'read_rangka_data and write_rangka_data read or seed the same documents',
      useFor: 'kanban cards, checklists, trackers, and anything a viewer changes by interacting with the rangka',
      example: 'serangkai://templates/canvasBoard',
    },
    // How the workspace and share reader frame an HTML rangka. Pick one per
    // rangka with a meta tag in <head>; the default needs none.
    presentation: {
      document: {
        marker: 'none (default)',
        behavior: 'The frame grows to the content height and the page scrolls, like a normal web page.',
        useFor: 'reports, articles, and long dashboards read top to bottom',
      },
      app: {
        marker: '<meta name="serangkai-presentation" content="app">',
        behavior: 'The frame fits the screen and your HTML scrolls inside it, so toolbars, sidebars, and inputs you pin with 100vh or position: fixed stay visible.',
        useFor: 'chat interfaces, tools, and layouts with a fixed sidebar or bottom bar',
      },
      canvas: {
        marker: '<meta name="serangkai-canvas" content="1920x1080">',
        size: `WIDTHxHEIGHT in CSS pixels, ${MIN_CANVAS_DIMENSION}-${MAX_CANVAS_DIMENSION} each`,
        behavior: 'Lay the board out at exactly the declared size. Viewers see it like a design file: fitted to the screen, then zoomed and panned.',
        viewerProvides: 'zoom (Ctrl/Cmd + wheel, pinch, + and -), pan (wheel, hand tool H, Space + drag, dragging outside the board), fit to screen (0), and toolbar buttons. Areas of the board that scroll themselves keep their own wheel scrolling.',
        youBuild: 'anything interactive on the board, such as dragging cards between columns. A plain drag inside the board reaches your script; use pointer events.',
        keys: 'Add <meta name="serangkai-canvas-keys" content="none"> when the board has its own keyboard shortcuts, so the viewer does not take them while the board has focus.',
        useFor: 'kanban boards, whiteboards, mind maps, mood boards, flowcharts, slides, and posters',
        example: 'serangkai://templates/canvasBoard',
      },
    },
  },
  authoring: {
    preferMarkdown: 'reports, documentation, and mixed narrative + data',
    preferHtml: 'custom dashboards, prototypes, and standalone applications',
    preferCanvas: 'anything laid out on a board people zoom and pan around, such as a kanban or whiteboard: HTML with the serangkai-canvas marker',
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

## Presentation mode

The shared reader sizes HTML to its content, so the page owns the scrollbar and
the footer follows the document.

Full-viewport applications that manage their own layout and scrolling should
opt into a bounded frame instead:

\`\`\`html
<meta name="serangkai-presentation" content="app">
\`\`\`

The iframe then fills the space between the shared header and footer and scrolls
internally. Document-style HTML (the default) needs no marker.

For a fixed canvas, add this marker to the HTML head:

\`\`\`html
<meta name="serangkai-canvas" content="1920x1080">
\`\`\`

Lay out the board within the declared viewport in CSS pixels (240 to 4096 per
dimension). The workspace and share reader fit the board and provide zoom
and pan controls. This marker also works in bundle HTML.

Use a canvas for anything people look around rather than read top to bottom:
kanban boards, whiteboards, mind maps, mood boards, flowcharts, slides, posters.

The viewer handles zoom (Ctrl/Cmd + wheel, pinch, \`+\`/\`-\`), pan (wheel, the
hand tool \`H\`, Space + drag, or dragging outside the board), and fit (\`0\`).
Areas of the board that scroll themselves, such as a long column, keep their
own wheel scrolling.
Everything on the board is yours: a plain drag inside the board reaches your
script, so draggable cards, sticky notes, or connectors work with ordinary
pointer events. See \`serangkai://templates/canvasBoard\` for a kanban board
with draggable cards that it saves with rangka data.

For a canvas app with its own keyboard commands, add
\`<meta name="serangkai-canvas-keys" content="none">\` to reserve keys for the app
while its frame has focus. The viewer toolbar and pointer gestures remain available.

## Saving data from interactions

A rangka that people change by using it, such as a kanban board where cards
move between columns, keeps that state in **rangka data** instead of its HTML.
Writes save immediately, survive a reload, and do not create a new version, so
restoring an older version of the design keeps the cards.

\`window.serangkai.data\` is available before your scripts run:

\`\`\`js
const store = window.serangkai.data
const { writable } = await store.info()        // false on shared pages
const cards = await store.list('cards')         // [{ id, data, updatedAt, updatedBy }]
await store.set('cards', 'c1', { title: 'Write notes', column: 'todo', order: 0 })
await store.update('cards', 'c1', { column: 'done' })   // shallow merge
await store.get('cards', 'c1')                  // document or null
await store.remove('cards', 'c1')
\`\`\`

- Documents are JSON objects (up to 64 KB) in named collections. Collection and
  document names use 1-64 letters, digits, \`-\` or \`_\`. A rangka holds up to
  5000 documents and 5 MB of data.
- Keep starting content in the HTML and replace it with the saved documents once
  there are any, so a new board still shows something before its first save.
- The owner's workspace can read and write. Shared pages can read, so a
  published board shows its cards, but \`info().writable\` is false and writes
  reject: let visitors interact locally without saving.
- Opened outside Serangkai, every call rejects. Catch errors and fall back to
  the built-in content.
- Agents can read or seed the same documents with \`read_rangka_data\` and
  \`write_rangka_data\`.

See \`serangkai://templates/canvasBoard\` for a kanban board that saves its cards.

## Security

- The frame is sandboxed and cannot reach the app origin.
- \`connect-src 'none'\` blocks network calls. Use \`serangkai.data\` to save state.
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
  canvasBoard: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="serangkai-canvas" content="1600x900">
  <title>Launch board</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1600px; height: 900px; overflow: hidden; }
    body { padding: 48px; font: 15px/1.45 system-ui, sans-serif; background: light-dark(#f6f3ec, #121614); color: light-dark(#1c2320, #eef0ea); }
    h1 { margin: 0 0 24px; font-size: 28px; }
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; height: 760px; }
    .column { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 16px; background: light-dark(#ebe6db, #1b211e); overflow: auto; }
    .column h2 { margin: 0 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
    .column.over { outline: 2px dashed light-dark(#0b7a5e, #42a082); outline-offset: -2px; }
    .cards { display: flex; flex-direction: column; gap: 12px; min-height: 48px; }
    .card { padding: 14px 16px; border-radius: 12px; background: light-dark(#fff, #252c28); box-shadow: 0 1px 2px rgb(0 0 0 / .12); cursor: grab; touch-action: none; user-select: none; }
    .card.dragging { position: fixed; z-index: 10; pointer-events: none; cursor: grabbing; box-shadow: 0 12px 28px rgb(0 0 0 / .25); }
    .add { width: 100%; padding: 10px 14px; border: 1px dashed light-dark(#b9b2a3, #3a443f); border-radius: 12px; background: transparent; color: inherit; font: inherit; }
    .readonly .add { display: none; }
  </style>
</head>
<body>
  <h1>Launch board</h1>
  <div class="board">
    <section class="column" data-column="todo"><h2>To do</h2><div class="cards"><div class="card" data-id="notes">Write release notes</div><div class="card" data-id="demo">Record the demo</div></div><input class="add" placeholder="Add a card and press Enter" maxlength="120"></section>
    <section class="column" data-column="doing"><h2>In progress</h2><div class="cards"><div class="card" data-id="meter">Fix the storage meter</div></div></section>
    <section class="column" data-column="done"><h2>Done</h2><div class="cards"><div class="card" data-id="deploy">Fork-based deploy guide</div></div></section>
  </div>
  <script>
    // Cards are kept in rangka data (serangkai.data), so moves and new cards
    // survive a reload without publishing a new version. The cards written
    // above are the starting content; once anything is saved, the saved cards
    // replace them. Shared pages are read-only, and outside Serangkai the data
    // API is unavailable, so the board then works locally only.
    const store = window.serangkai && window.serangkai.data
    let writable = false

    function columnFor(name) { return document.querySelector('[data-column="' + name + '"] .cards') }
    function cardElement(id, title) {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = id
      card.textContent = title
      return card
    }

    async function load() {
      if (!store) return
      try {
        writable = (await store.info()).writable
        document.body.classList.toggle('readonly', !writable)
        const saved = await store.list('cards')
        if (!saved.length) return
        for (const list of document.querySelectorAll('.cards')) list.replaceChildren()
        saved.sort((a, b) => a.data.order - b.data.order)
        for (const { id, data } of saved) (columnFor(data.column) || columnFor('todo')).append(cardElement(id, data.title))
      } catch (error) {
        console.warn('Board data unavailable; using the built-in cards.', error)
      }
    }

    // Save every card's column and position. A small board can simply write
    // all of them; a large one would write only the columns that changed.
    function save() {
      if (!writable) return
      for (const column of document.querySelectorAll('.column')) {
        column.querySelectorAll('.card').forEach((card, order) => {
          store.set('cards', card.dataset.id, { title: card.textContent, column: column.dataset.column, order })
            .catch(error => console.warn('Could not save the card.', error))
        })
      }
    }

    document.querySelector('.add').addEventListener('keydown', (event) => {
      const title = event.target.value.trim()
      if (event.key !== 'Enter' || !title) return
      columnFor('todo').append(cardElement('c' + Date.now().toString(36), title))
      event.target.value = ''
      save()
    })

    // Drag cards between columns. A plain drag inside the canvas reaches this
    // script; the viewer pans with the hand tool, Space + drag, or the wheel.
    let drag = null
    document.addEventListener('pointerdown', (event) => {
      const card = event.target.closest('.card')
      if (!card || event.button !== 0) return
      const box = card.getBoundingClientRect()
      drag = { card, dx: event.clientX - box.left, dy: event.clientY - box.top, over: null }
      card.style.width = box.width + 'px'
      card.classList.add('dragging')
      move(event)
      card.setPointerCapture(event.pointerId)
    })
    document.addEventListener('pointermove', (event) => { if (drag) move(event) })
    document.addEventListener('pointerup', () => {
      if (!drag) return
      const { card, over } = drag
      card.classList.remove('dragging')
      card.style.cssText = ''
      if (over) { over.classList.remove('over'); over.querySelector('.cards').append(card); save() }
      drag = null
    })
    function move(event) {
      drag.card.style.left = event.clientX - drag.dx + 'px'
      drag.card.style.top = event.clientY - drag.dy + 'px'
      const column = document.elementFromPoint(event.clientX, event.clientY)?.closest('.column') || null
      if (column !== drag.over) { drag.over?.classList.remove('over'); column?.classList.add('over'); drag.over = column }
    }

    load()
  <\/script>
</body>
</html>
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
  createCanvasBoard: 'Create a kanban board as an HTML canvas rangka. Declare <meta name="serangkai-canvas" content="1600x900"> and lay the board out at exactly that size so viewers can zoom and pan it. Make the cards draggable between columns with pointer events, and save their columns with serangkai.data so moves survive a reload. Keep it self-contained. Start from serangkai://templates/canvasBoard.',
  createReport: 'Create a polished Markdown report using Serangkai authoring capabilities. Include headings, a table, a chart, and one Selaras callout. Keep the source portable.',
  createDashboard: 'Create a Markdown dashboard using Selaras cards and a TanStack chart. Use the declarative chart schema; do not write chart JavaScript.',
  createHtmlDocument: 'Create a styled HTML report using the opt-in Selaras document theme. Keep it self-contained and include one Mermaid diagram.',
  createCustomDashboard: 'Create a custom-designed HTML dashboard with your own CSS. Do not use the Selaras document theme. Include one chart marker.',
}
