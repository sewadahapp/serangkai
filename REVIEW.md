# Artifact Authoring System — Independent Review

**Scope:** Comark rendering and sanitization, Selaras component registry, TanStack
Charts + Mermaid integrations, HTML artifact sandboxing, the opt-in Selaras
document theme, MCP authoring discovery, and the previously flagged public-slug
and Cloudflare R2 risks.

**Method:** source review of the installed `comark@0.9.0`, `@comark/vue@0.9.0`
and `@sewadah/selaras@1.3.0`; adversarial parser probes; API-level security
tests; Chromium sessions at 1280×900 and 390×844, light and dark; an MCP-only
authoring run using a fresh API token with no repository context.

Every finding below is either **reproduced** (with the command or payload that
shows it) or marked **unverified**. Fixed items list the regression test that now
covers them.

---

## P0 — Critical (all fixed)

### 1. SVG/image artifacts executed scripts on the app origin
**Affected:** `server/api/share/[slug]/index.get.ts`

Image delivery echoed `artifact.metadata.mimeType` verbatim and set no CSP. The
REST create endpoint accepts arbitrary `metadata`, so `type:image` +
`metadata.mimeType:'text/html'` served author HTML as a same-origin document.
Uploaded SVGs were equally dangerous: navigating to the share URL executed their
`<script>` under the app origin with the reader's session cookie.

**Reproduced:** created an image artifact with `mimeType: 'text/html'`; `GET
/api/share/:slug` returned `Content-Type: text/html` with no
`Content-Security-Policy`, and `document.title` was attacker-controlled.

**Fix:** image responses now ignore non-`image/*` MIME metadata (falling back to
the filename extension, then PNG), always send `Content-Security-Policy: sandbox;
default-src 'none'; style-src 'unsafe-inline'` plus `nosniff`, and never
`text/html`.
**Test:** `tests/security-api.test.mjs` — "image metadata cannot upgrade a
non-SVG artifact to an executable type"; "shared images … cannot execute
scripts".

### 2. Bundle documents bypassed the sandbox CSP
**Affected:** `server/api/share/[slug]/[...path].get.ts`

The CSP was applied only when `path.endsWith('.html')`. `EVIL.HTML` and
`image.svg` inside a ZIP were served as `text/html` / `image/svg+xml` with no
CSP, executing script on the app origin (verified: `document.title` changed and
`/api/tokens` returned the victim's tokens).

**Fix:** CSP is now chosen from the resolved MIME type, so any `text/html` or
`image/svg+xml` bundle asset is sandboxed.
**Test:** same file — "shared images and bundle documents cannot execute scripts
on the app origin".

### 3. CSS/UI injection through nested component data
**Affected:** `server/utils/markdown.ts`

Selaras spreads nested item objects onto DOM nodes (`Timeline` uses
`:class="item.class"` and `v-bind="itemUi(item,'item')"`, which merges
`item.ui.item`). The old sanitizer validated only top-level props, so

```mdc
::s-timeline{items='[{"id":"1","title":"Overlay","class":"fixed inset-0 z-[9999] bg-white"}]'}
::
```

covered the entire viewport, including the app header (verified by hit-testing
`elementFromPoint(100,60)`).

**Fix:** `sanitizeDataValue()` recursively walks every array/object, rejects
`style`, `class`, `className`, `ui`, `as`, `is`, prototype keys and real DOM
event-handler names, enforces a 12-level / 2 000-node / 100 KB budget, validates
nested URL keys (`to`, `href`, `src`, `srcset`, …), and restricts icon fields to
`lucide:`.
**Test:** "sanitizes nested URLs and CSS-bearing keys inside component arrays";
"blocks event handlers inside data structures".

### 4. `as`/`is` turned native elements into unvalidated Selaras components
**Affected:** `server/utils/markdown.ts`

Comark keeps `as` on raw HTML blocks, and `@comark/vue` resolves it to a
component: `<div as="s-button" to="/x" ui="…">` rendered a real `SButton` with
raw props, bypassing the registry entirely.

**Fix:** `as`, `is` and `ui` are deleted from every non-registry node.
**Test:** "does not let a native element become an unvalidated dynamic
component".

### 5. Public share identifiers collided across users
**Affected:** `server/db/schema.ts`, `server/api/artifacts/index.post.ts`,
`server/db/migrations.ts`, `server/utils/artifacts.ts`

The schema only enforced `UNIQUE(user_id, slug)`, but `/api/share/:slug`
resolves by slug alone. Two accounts could each own `collide`, and the reader
resolved whichever row SQLite returned first — one user's link could open
another user's artifact, or 403 when the shadowing row was private (both
reproduced).

**Fix:** startup migration renames pre-existing duplicates deterministically
(oldest keeps the slug, later ones get `<slug>-<id6>`) and creates
`UNIQUE INDEX artifacts_slug_unique`. All create paths (REST, upload, duplicate,
MCP) reserve globally unique slugs and return 409 on a race.
**Test:** `tests/artifacts-lifecycle.test.mjs` — "share identifiers are globally
unique and cannot collide across users". D1 path exercised by
`tests/cloudflare-runtime.test.mjs` (passing).

### 6. Cloudflare R2 fell back to ephemeral storage silently
**Affected:** `server/plugins/storage.ts`, `server/utils/config.ts`

A missing/incorrect R2 binding mounted `unstorage`'s memory driver with only a
`console.warn`, so a production Worker would accept writes that vanish with the
isolate while health checks stayed green.

**Fix:** startup now throws unless `SERANGKAI_ALLOW_EPHEMERAL_STORAGE=true`
**and** `NODE_ENV !== 'production'`. The flag is documented as test/development
only.
**Test:** `tests/config.test.mjs` — "production never allows the ephemeral
storage fallback"; `tests/cloudflare-runtime.test.mjs` still asserts no fallback
warning.

---

## P1 — Major correctness and security (fixed)

### 7. Component data was silently corrupted by the Comark security plugin
**Affected:** `server/utils/markdown.ts`

Comark's `validateValue` walks nested props and drops any key starting with
`on`, intending to strip event handlers. That also deleted legitimate data:
`{"owner":"Ada","onboarding":true,"online":0,"one":1}` became
`{"owner":"Ada","name":"A"}`. Data tables and timelines lost columns with no
error. Reproduced directly with `createMarkdownParser` + `comark/plugins/security`.

**Fix:** structured props are serialized to JSON before the security pass (so it
cannot misinterpret their keys) and rehydrated afterwards by
`restoreStructuredProps`. Our own recursive sanitizer, which matches real DOM
event names rather than any `on` prefix, is the authority.
**Test:** "preserves legitimate nested data keys such as owner/onboarding but
blocks event handlers".

### 8. Documented kebab-case props and bare booleans were dropped
**Affected:** `server/utils/markdown.ts`, `shared/artifact-components.ts`

The registry documented `default-value`, `model-value`, `default-open`,
`items-per-page` and flag-style `striped`, but the sanitizer only matched
camelCase keys, so tabs/accordions/toggles/progress lost their initial state
(verified: `s-progress{model-value="68"}` rendered `aria-valuenow=null`;
`s-table{… striped}` lost `striped`).

**Fix:** kebab keys are normalized to camelCase, and `:prop="JSON"` bindings are
parsed as literal JSON (never evaluated). `SButton` also advertised a
nonexistent `label` prop; removed.
**Test:** "accepts kebab-case props and bare boolean attributes".

### 9. Unbounded chart geometry froze the reader
**Affected:** `app/utils/chart.ts`, `runtime/charts.ts`

`height` was passed through untouched; `{"height":100000000}` produced a
33 554 432 px element (measured in Chromium), hanging layout and scroll.
Non-finite numbers and empty `data` arrays were passed straight to TanStack.

**Fix:** height is clamped to 120–1200 px, rows are capped at 2 000, non-finite
coordinates become `null`, and charts with no numeric `y` fall back to the JSON
block instead of rendering an empty scale.
**Test:** covered by `tests/browser-workspace.test.mjs` chart coverage plus the
new render check (invalid definitions no longer crash).

### 10. GitHub alert blockquotes lost their type
**Affected:** `server/utils/markdown.ts`

Comark's alert plugin marks `> [!NOTE]` with `as="note"`, which the security
plugin strips as an unsafe tag selector; the rendered result was a plain
blockquote. Mapped explicitly to `SCallout` with the correct tone now.
**Test:** "renders GitHub alert blockquotes as Selaras callouts".

---

## P2 — Rendering, theming, and compatibility (fixed)

### 11. The opt-in document theme's webfont never loaded
A sandboxed iframe has an opaque origin, so `/fonts/*.woff2` was blocked by
`font-src https: data:` and then by CORS. Measured inside the frame:
`document.fonts` reported `Plus Jakarta Sans: error`. Added `'self'` to
`font-src` and `Access-Control-Allow-Origin: *` for `/fonts/**`; the font now
reports `loaded` in light and dark, with the theme's tables, code blocks and
`light-dark()` colours verified in both modes.
**Test:** `tests/artifact-theme.test.mjs` — theme font path, CORS directive, and
a guard that every `--selaras-resolved-*` token the prose stylesheet reads is
declared by the generated theme (catches Selaras token drift on upgrade).

### 12. Mobile horizontal overflow on component-heavy documents
The share grid and artifact layout lacked an explicit `grid-cols-1`, so wide
Selaras content (code trees, pagination, steppers) pushed the article to 475 px
inside a 390 px viewport. Added `grid-cols-1` to the Markdown reader and artifact
page; measured overflow is now 0 at 390 px.

### 13. Minor
- `SButton` no longer advertises a `label` prop it does not have.
- README rendered fine; TOC only includes h2–h4 by design (`toc({depth:3})`).
- Mermaid error handling verified: invalid syntax shows "Unable to render
  diagram." rather than throwing, and `securityLevel:'strict'` is set in both
  the Markdown component and the sandbox runtime.

---

## P3 — Improvements (documented, not required)

- **MCP discovery**: a fresh token can list resources, read the Markdown/HTML
  guides and component catalog, and create a polished report. I improved two
  over-long tool descriptions (`create_artifact`, `update_artifact`) so they
  stay concise and defer detail to the resources, per the stated preference.
  The `baseVersion` contract is stated in `update_artifact` and in the guides.
- **Blind-agent test**: the run above used only MCP (no repo, no Selaras skill,
  no project instructions) and produced a report with table, callout, bar and
  line charts, Mermaid flowchart, accordion and timeline. This is a real
  MCP-only run, but it is *not* a fully independent third-party agent; treat it
  as automated MCP-only verification, matching `docs/authoring/README.md`.
- **Chart schema**: `runtime/charts.ts` and `app/utils/chart.ts` share one
  resolver, so Markdown and HTML behave identically. Advertised types are bar,
  line, area and horizontal bar; anything else falls back safely. The MCP
  capability document says exactly this rather than implying full TanStack API.

---

## Verification performed

| Check | Result |
| --- | --- |
| `bun run build` (node-server) | pass |
| `bun run build:cloudflare` | pass |
| `bun run test:ci` (45 tests) | pass |
| `tests/cloudflare-runtime.test.mjs` (D1 + R2, no fallback) | pass |
| Markdown: headings, tables, lists, images, code, task lists | pass |
| Rich Comark: alert, card, callout, badge, table, tabs, accordion, timeline | pass |
| Charts: bar, line, area, horizontal, invalid JSON, huge height, bogus type | pass |
| Mermaid: flowchart + sequence; invalid syntax fallback | pass |
| HTML + Selaras document theme, light and dark, font, table, code, chart, Mermaid | pass |
| Self-styled HTML dashboard unchanged | pass |
| Static bundle app (own CSS + JS) | pass |
| Desktop 1280×900 and mobile 390×844, overflow | 0 px overflow |
| SSR + hydration (no console errors, fallbacks replaced) | pass |

**Not verified:** real remote Cloudflare or Vercel deployments, and a genuinely
independent third-party agent. Neither is claimed as verified.

---

## Go/no-go

The authoring system is fit for production use once these changes ship. The
remaining operational requirement is configuration, not code: keep
`SERANGKAI_ALLOW_EPHEMERAL_STORAGE` unset in production and confirm the
`ARTIFACTS` R2 binding exists, after which the app fails fast instead of losing
data.
