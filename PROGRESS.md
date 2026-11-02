# Serangkai Progress

## Status
MVP end-to-end workflow implemented and verified

## Completed
- [x] Nuxt 4 + TypeScript + Selaras scaffolding
- [x] Repository-local Git identity configured
- [x] SQLite schema auto-initialization for fresh deployments
- [x] Local filesystem storage adapter
- [x] Registration, login, logout, session auth, scoped API token endpoints
- [x] Nested folder creation and artifact organization
- [x] Artifact creation for Markdown, HTML, JSON, and related types
- [x] Artifact update and delete endpoints
- [x] Immutable artifact version history and listing endpoint
- [x] Workspace search across artifact titles/slugs and folder names
- [x] Basic MCP JSON-RPC-style tools endpoint
- [x] Official MCP SDK Streamable HTTP transport with authenticated tools
- [x] Automated MCP protocol tests (initialize, tools/list, tools/call, auth denial)
- [x] Authenticated multipart upload/download with binary preservation and size/type validation
- [x] Signed capability links for unlisted artifacts
- [x] Automated upload and sharing negative/API tests
- [x] HTML/Markdown isolation headers and security negative tests
- [x] Security model documented in SECURITY.md
- [x] Browser-level smoke test using installed Google Chrome
- [x] Safe Markdown rendering with `marked` + `sanitize-html`
- [x] CSP headers for public Markdown and HTML artifact delivery
- [x] Private-by-default authorization checks
- [x] Human UI create-folder/create-artifact workflow
- [x] Human UI search workflow
- [x] Human UI artifact edit and version-history workflow
- [x] Dockerfile, docker-compose, README, architecture and agent docs

## Verification
- `npm run build` passes
- Fresh SQLite database smoke test passes
- Health, registration, session auth, folder creation, artifact creation and listing pass
- Artifact update creates version 2 and version history lists versions 2 and 1
- Public Markdown returns rendered `<h1>` and restrictive CSP
- Search returns matching artifacts
- Latest commits use `Wicaksana Pratama <wicaksanapratama@gmail.com>`

## Next Milestones
- [ ] Add browser-level tests with Playwright
- [ ] Add multipart upload and static bundle handling
- [ ] Add Mermaid/charts MDC components
- [ ] Add isolated HTML artifact origin/sandbox review and negative security tests
- [ ] Add share settings UI and signed unlisted links
- [ ] Add Cloudflare/Vercel/InstaCloud deployment adapters only after verification
