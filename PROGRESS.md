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
- [x] Static website bundle upload, ZIP validation, scoped serving, and tests
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
- [x] Dockerfile healthcheck, non-root runtime, persistent-volume settings, and deployment checklist
- [x] Verify Docker-compatible image/container with Podman: build, health, registration, restart persistence
- [ ] Verify InstaCloud template and persistent volume behavior
- [x] Add Nitro `cloudflare_module` and `vercel` preset configuration
- [x] Add Wrangler/Vercel provider templates and deployment documentation
- [x] Add provider configuration integration test
- [ ] Verify Cloudflare/Vercel builds with provider CLIs and portable storage adapters
- [x] Add portable S3-compatible and Cloudflare R2 object storage adapter contracts
- [x] Add storage provider configuration tests
- [ ] Add portable D1/serverless database adapter and full provider runtime tests
- [x] Add request-scoped Drizzle D1 adapter and D1 schema bootstrap helper
- [x] Add SQLite/D1 provider-selection and D1-compatible mock integration tests
- [x] Refactor API and auth route database access through request-aware provider resolution
- [x] Add local SQLite end-to-end runtime test after provider refactor
- [x] Add Wrangler/Miniflare local D1 runtime test for registration, creation, and listing
- [ ] Make Wrangler/Miniflare D1 runtime test green; current blocker is Node-only SQLite dependency leakage into Worker graph
- [x] Capture the real Wrangler/Miniflare startup blocker without masking it in tests
- [x] Diagnose Node built-in leakage and reject the broken dynamic-import workaround
- [x] Pass Wrangler/Miniflare D1 runtime test for registration, artifact creation, and listing
- [x] Replace Node JWT dependency with Web Crypto-compatible `jose` for edge runtime
- [x] Add durable R2 adapter contract and binary storage test
- [x] Add request-scoped R2 binding runtime test with a mocked Cloudflare binding
- [x] Verify no disposable Serangkai background servers remain running
- [x] Verify Wrangler Cloudflare deploy dry-run and D1 binding configuration without upload
- [x] Verify Docker Compose required-secret interpolation and deployment-file invariants
- [x] Add release-readiness test for explicit remote deployment boundaries
- [x] Add CI workflow structure test covering build and integration checks
- [x] Add deployment documentation index with conservative provider status matrix
- [x] Add remote deployment verification runbook without claiming provider support
- [x] Add passing Vercel Node runtime integration test for registration and artifact listing
- [x] Verify local provider runtime suite: SQLite, D1/Miniflare, Vercel Node, R2 contracts
- [x] Verify request-scoped R2 is used by artifact route storage resolution
- [x] Add deployment verification matrix separating local evidence from real-provider claims
- [x] Add reproducible GitHub Actions verification workflow for local and provider-contract coverage
- [x] Run consolidated local provider/API/security/browser/bundle verification suite successfully
- [x] Stop and verify disposable tmux/server processes and confirm ports 3199, 3210, and 3788 are closed
