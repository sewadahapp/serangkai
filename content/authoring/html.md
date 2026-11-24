---
title: HTML and bundles
description: Self-styled HTML, the optional document theme, chart and diagram markers, and static app bundles.
order: 3
---

# HTML and bundles

HTML rangka run your own markup, CSS, and JavaScript inside a sandboxed iframe.
They are self-styled by default: Serangkai does not inject Selaras or Tailwind
into them.

## The Selaras document theme

Opt in with one meta tag to get polished typography, tables, code blocks,
spacing, and light and dark colors:

```html
<head>
  <meta name="serangkai-theme" content="selaras-document">
</head>
```

The theme is CSS only. It does not provide Vue components; for those, build an
app and upload it as a [bundle](#bundles).

## Charts and diagrams

Mark up charts and Mermaid diagrams and Serangkai renders them for you:

```html
<pre class="mermaid">flowchart LR
  Draft --> Review --> Share
</pre>

<script type="application/json" data-serangkai-chart>
{"type":"bar","data":[{"week":"W1","value":12}],"x":"week","y":"value"}
</script>
```

## Color mode

Use `color-scheme: light dark` and `light-dark()` to follow the reader's mode.
To pin one scheme:

```html
<meta name="color-scheme" content="only light">
```

## Presentation modes

An HTML rangka is shown one of three ways, in the workspace and on shared
links alike. Pick one with a meta tag in `<head>`; the default needs none.

| Mode | Marker | Who scrolls | Use for |
| --- | --- | --- | --- |
| Document | none | The page; the frame grows to the content | Reports, articles, long dashboards |
| App | `<meta name="serangkai-presentation" content="app">` | The HTML, inside a screen-sized frame | Chat UIs, tools, layouts with a fixed sidebar or bottom bar |
| Canvas | `<meta name="serangkai-canvas" content="1920x1080">` | Nobody; viewers zoom and pan | Kanban boards, whiteboards, mind maps, slides, posters |

In app mode, toolbars and inputs the HTML pins with `100vh` or
`position: fixed` stay on screen, because the frame never grows taller than the
space between the header and footer.

### Canvas

Declare the board size in CSS pixels (240 to 4096 per side) and lay the board
out at exactly that size. Viewers then see it like a design file: fitted to the
screen, with zoom (Ctrl/Cmd + wheel, pinch, `+`/`-`), pan (wheel, the hand tool
`H`, Space + drag), and fit (`0`).

Everything on the board belongs to the HTML. A plain drag inside the board
reaches your script, so draggable cards or sticky notes work with ordinary
pointer events; the `canvasBoard` template is a kanban board built that way.
If the board has its own keyboard shortcuts, add
`<meta name="serangkai-canvas-keys" content="none">` so the viewer leaves those
keys alone.

## Sandbox

The frame is sandboxed, cannot reach the app origin, and runs with
`connect-src 'none'`, so the page cannot make network requests. Scripts must be
inline; images and fonts may load over `https:`.

## Bundles

Upload a ZIP of a static site, such as a built Vue or React app, to publish it
as a bundle. It is served sandboxed and behind the same authorization as any
other rangka. Bundles do not get the document theme automatically; a prebuilt
Vue app can import Selaras itself.
