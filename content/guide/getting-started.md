---
title: Getting started
description: Set up your project and make your first API request.
---

# Getting started

This guide is a sample setup flow. Replace its commands, setup steps, and API details with the ones for your own project.

## Install dependencies

Choose a package manager you already use:

::SCodeGroup

```sh [npm]
npm install
npm run dev
```

```sh [pnpm]
pnpm install
pnpm dev
```

```sh [Bun]
bun install
bun run dev
```

::

Open `http://localhost:3000` to see the starter. The docs layer provides the documentation layout and reads pages from `content/`.

## Make your first request

The example API uses a project token. Replace the sample URL and token with values from your own service:

```sh
curl https://api.example.com/v1/projects \
  -H "Authorization: Bearer $API_TOKEN"
```

See the [API reference](../reference/api) for a sample endpoint and response.

## Make it yours

1. Change the site name, description, and header links in `app/app.config.ts`.
2. Replace the sample content with your guides and reference material.
3. Set your repository URL in the `selarasDocs.repository` config to enable edit links.
4. Run `npm run generate` to create a static site, or `npm run build` for a Nuxt server deployment.

::SCallout{type="note" title="No extra shell setup"}
The docs layer already provides the default app shell and styles. Start by editing the content and app config; add a custom Nuxt component only when your docs need behavior the layer does not include.
::
