# Serangkai site

The landing page and documentation for [Serangkai](https://github.com/sewadahapp/serangkai).
This `site` branch shares no history with the app: it holds only the website,
built with Nuxt 4 and the `@sewadah/selaras-docs` layer, and deploys to GitHub
Pages on every push.

```sh
bun install --frozen-lockfile
bun run dev        # http://localhost:3000
bun run generate   # static output in .output/public
```

- Landing page: `app/pages/index.vue` and `app/components/landing/`
- Documentation: Markdown under `content/`
- Site settings: `app/app.config.ts`

To work on it next to the app, check it out as a worktree:

```sh
git worktree add ../serangkai-site site
```
