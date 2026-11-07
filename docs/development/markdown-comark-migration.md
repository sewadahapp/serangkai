# Comark migration complete

## What changed

- Replaced `marked` + `sanitize-html` + manual DOM mounting with `@comark/vue` parsing and rendering.
- Removed `@nuxtjs/mdc`, `rehype-sanitize`, and `unified` dependencies.
- Added `comark`, `@comark/vue`, `@shikijs/langs`, `@shikijs/themes`.
- Server parses once to a serialized document, then renders with `<MarkdownDocument>` without the parser in the browser.
- Security enforced by Comark’s security plugin plus a custom artifact transform that maps only trusted tags/components and strips dangerous props/styles/events.

## Rendering

- Headings preserve IDs; TOC is extracted from parsed metadata.
- Code fences render with Shiki dual themes; copy source reconstructed from original node.
- Mermaid charts and TanStack Charts rendered as trusted component nodes (`serangkai-mermaid`, `serangkai-chart`).
- Inline code highlights when a language is declared via attributes or fenced.
- Tables, lists, quotes, task-list checkboxes (non-interactive), raw HTML tags supported.
- Unknown components and event handlers stripped; expressions kept as literal text.

## Selaras component support

Only approved declarative and restricted-local-state components are available:

### Declarative (safe, read-only)

Alerts, avatars/groups, badges, chips, icons, kbd, progress (read-only), separators, skeletons, cards/groups/container/scroll-area, callouts, code-button/tree/file-tree, empty state, table (display-only), timeline.

Mermaid and chart components also provided.

### Restricted (local toggle without writes)

Buttons (links only), toggles (default value), toggle groups (items, default), accordions/collapsible (default open), tabs, pagination, stepper, tree, read-more.

Application-only: forms (checkboxes, switches, inputs), overlays (alerts/modals/drawers/slideoasts/toasts/commands/contextmenus/popovers/dropdowns), dashboard/nav shells, theme/color-mode controls, form fields, calendars, transfer lists, editable, color picker, pin input, slider, rating. These require application state/callbacks and remain unavailable in Markdown artifacts.

## Testing

- Unit tests verify parsing, sanitization, Shiki highlighting, component normalization, and rejection of unsafe content.
- Browser tests cover Markdown with tables, code fences, Mermaid/charts, and Selaras components.
- All relevant integration/API tests pass after migration.

## Authoring examples

See `shared/artifact-components.ts` for the registry and examples. Key patterns:

- Ordinary Markdown with links, tables, and GFM checkboxes.
- Code fences with language info strings highlight via Shiki.
- ```chart``` and ```mermaid```: JSON schema diagrams and flowcharts.
- :::s-alert{...}, :::s-card{}, :::s-table{}: Selaras components.
- ::s-icon{name="lucide:sparkles"}, ::s-badge{label="Stable"}: lightweight elements.
- Local-state toggles/tabs/accordions use default-value prop; no v-model/bindings.

No CDN load, no author JavaScript execution, no arbitrary Vue templates — all handled server-side.
