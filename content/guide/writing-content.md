---
title: Writing content
description: Organize Markdown pages and create useful examples.
---

# Writing content

Create `.md` files in `content/`. Use frontmatter for page metadata and nested folders to keep guides, tutorials, and reference material organized.

```text
content/
├── guide/
│   ├── getting-started.md
│   └── writing-content.md
└── reference/
    └── api.md
```

## Page metadata

```md
---
title: API authentication
description: Configure a token for your first request.
---

# API authentication
```

The title appears in the page navigation and search results, while the description provides a short summary. The homepage lives in `app/pages/index.vue`; the guide and reference pages remain Markdown under `content/`.

## Add helpful context

Use callouts to make important context easy to scan:

::SCallout{type="warning" title="Keep secrets out of Markdown"}
Use environment variables for credentials. Content files are versioned with your source code and may be published with the site.
::

Use fenced code blocks for commands and examples. Group alternatives with `::SCodeGroup` and add a filename or language label to each fence:

::SCodeGroup

```ts [TypeScript]
const client = createClient({ token: process.env.API_TOKEN })
```

```js [JavaScript]
const client = createClient({ token: process.env.API_TOKEN })
```

::

Markdown tables, lists, links, and headings work as usual. The docs shell builds a contents outline from page headings and handles navigation. The examples below show a few reusable ways to present documentation content. For the landing page, see [the homepage hero patterns](homepage-heroes).

<DocsContentPatterns />
