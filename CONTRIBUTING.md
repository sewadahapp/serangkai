# Contributing to Serangkai

Thanks for your interest in Serangkai. We want contributions to be easy to
make and easy to review. This document covers the practical details.

## What Serangkai is

A self-hosted workspace where people and AI agents publish interactive work:
reports, dashboards, HTML apps, diagrams, and charts. See the
[README](README.md) for the full picture.

## Before you start

Read these first — they describe the architecture and the conventions that
matter most:

- [`AGENTS.md`](AGENTS.md) — terminology, core principles, and the rules that
  are easy to get wrong (Bun-only toolchain, Nitro 2, security model).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the pieces fit together.
- [`README.md`](README.md) — user-facing behaviour and deployment.
- [`SECURITY.md`](SECURITY.md) — the security model; please understand it
  before touching auth, sharing, or HTML rendering.

Terminology matters: use **rangka** for both singular and plural throughout
the UI, APIs, MCP, and internals. MCP tools advertise only `*_rangka` names,
and only capabilities that are actually implemented and verified.

## Development setup

Requires **Bun 1.4+**. Node 24 is needed only for the Node fallback and Vercel
runtime checks.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run dev
```

The dev server listens on `127.0.0.1:6969` with the development credentials
`admin` / `serangkai-dev`. Sign in at `/auth/login`.

Conventions that will save you time:

- `bun.lock` is the only committed lockfile. Do not add `package-lock.json` or
  run npm to work around dependency problems.
- Use `--ignore-scripts` on install. Bun uses `bun:sqlite` at runtime;
  `better-sqlite3` is only for the Node fallback.
- Nuxt 4 / Nitro 2 / H3 v1. Do not upgrade to Nitro 3 or use its `nitro/database`,
  `useKV`, or H3 v2 APIs — Nuxt 4 has not moved to that line.
- Icons are Lucide only. Overrides live in `shared/selaras-icons.ts` and
  `app/app.config.ts`.
- `shared/rangka-components.ts` is the single source of truth for supported
  components. Do not add renderer-only component lists.
- Markdown is parsed once on the server into a sanitized document. Never
  evaluate author expressions or template code.

## Making a change

1. Open an issue first for anything substantial — a short description of the
   problem and your approach avoids duplicated work.
2. Fork the repository and create a focused branch, e.g.
   `fix/share-link-expiry` or `feat/folder-picker-search`.
3. Keep changes small and focused. One concern per pull request.
4. Add or update tests for anything non-trivial. Security-critical behaviour
   (authz, sharing, tokens, HTML sandboxing, migrations) needs a test.
5. Update the docs when behaviour changes. `README.md`, `ARCHITECTURE.md`, and
   `AGENTS.md` are maintained files, not afterthoughts.

### Commit messages

Releases are generated from conventional commits, so please use them:

```
feat: add folder picker search
fix: preserve share links across restart
docs: clarify Turso migration steps
refactor: split storage quota helpers
test: cover unlisted link revocation
chore: bump selaras to 1.4.1
```

Use `feat!:` or a `BREAKING CHANGE:` footer for breaking changes. Avoid
combining unrelated changes in one commit.

## Before opening a pull request

For code changes, run the release test suite locally. It builds the Node server
output before running the tests.

```bash
bun run test:ci
```

The [Verify workflow](.github/workflows/verify.yml) also runs dedicated API,
browser, and Node fallback checks on pull requests.

Other useful checks, depending on what you changed:

```bash
bun run test:auth              # auth, OAuth, tokens
bun run test:docker            # container persistence (Docker or Podman)
bun run test:provider-local    # Cloudflare / Vercel / Turso local matrix
bun run test:turso             # libSQL adapter and OAuth atomicity
```

In your pull request, describe what changed and why, link the issue, and note
which tests you ran. A short before/after screenshot is welcome for UI work.

### Docker and release changes

Docker compilation must use `BUILDPLATFORM`, never QEMU. Releases package the
single tested node-server output through the `prebuilt` target, and
`prepare-docker-output.mjs` is a publication gate. If you touch this area,
run both target runtimes with `scripts/smoke-docker.sh`. Version bumps and
release publishing are maintainer-only via the Release workflow — please do
not bump `package.json` or `CHANGELOG.md` in a feature PR.

## Security issues

**Do not open a public issue for a security vulnerability.** Follow the
private reporting process described in
[GitHub's security advisory page](https://github.com/sewadahapp/serangkai/security/advisories/new)
so it can be fixed before details are public.

When writing code, treat these as hard rules:

- Writes always require auth; scoped API tokens are for agents. Reads of
  private rangka require auth or permission, and only explicitly shared rangka
  are public.
- A browser session must never authorize MCP, and a bearer token must never
  fall back to a session.
- Never add public registration. The single owner comes from the environment.
- Isolate untrusted HTML/JS execution with sandboxed iframes and CSP.
- Markdown is sanitized server-side; never evaluate author expressions.
- No secrets in code or logs.

## Getting help

Open an issue for bugs and feature proposals. For questions about using
Serangkai, the [demo](https://serangkai.onrender.com) and the
[authoring docs](docs/authoring/README.md) are good starting points. Please
be patient — this is a small project, and replies may take a few days.
