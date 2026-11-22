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

## Presentation mode

By default the reader sizes HTML to its content, so the page owns the scrollbar
and the footer follows the document. Full-viewport apps that manage their own
layout and scrolling can ask for a bounded frame instead:

```html
<meta name="serangkai-presentation" content="app">
```

## Sandbox

The frame is sandboxed, cannot reach the app origin, and runs with
`connect-src 'none'`, so the page cannot make network requests. Scripts must be
inline; images and fonts may load over `https:`.

## Bundles

Upload a ZIP of a static site, such as a built Vue or React app, to publish it
as a bundle. It is served sandboxed and behind the same authorization as any
other rangka. Bundles do not get the document theme automatically; a prebuilt
Vue app can import Selaras itself.
