# Serangkai Progress

## Status
MVP core features implemented - basic end-to-end workflow functional

## Completed
- [x] Repository inspection
- [x] Architecture planning (ARCHITECTURE.md)
- [x] Agent guidelines (AGENTS.md)
- [x] Implementation plan
- [x] Nuxt 4 project scaffolding with TypeScript + Bun
- [x] Dependencies installed (Nuxt 4, Selaras UI, Nuxt Content, SQLite, Drizzle ORM, auth libs)
- [x] Nuxt config with Selaras and Content modules
- [x] Database schema (users, apiTokens, folders, artifacts, artifactVersions)
- [x] Storage adapter pattern (local filesystem)
- [x] Auth utilities (bcrypt password hashing, JWT sessions, API token hashing)
- [x] Auth middleware for session/API token validation
- [x] Auth API routes (register, login, logout, me)
- [x] API tokens CRUD endpoints
- [x] Folders CRUD endpoints
- [x] Artifacts CRUD API endpoints
- [x] Public share endpoint for artifacts
- [x] MCP server endpoint (basic JSON-RPC style)
- [x] UI layout with Selaras components
- [x] Pages: home, auth (login/register), workspace, artifact view
- [x] Health endpoint
- [x] Dockerfile and docker-compose.yml for deployment
- [x] README with basic documentation

## In Progress
- [ ] Test the application (build and dev server)
- [ ] Fix any integration issues with Selaras components
- [ ] Improve Markdown rendering with MDC

## Next Steps
- M5: Enhanced Markdown rendering with MDC components, Mermaid, TanStack Charts
- M6: Better file upload handling for all artifact types
- M7: Proper sandboxing for HTML/JS artifacts
- M8: Full MCP protocol compliance
- M9: Enhanced sharing/permissions
- M10: Version history UI and API
- M11: Testing and deployment verification

## Notes
- Basic end-to-end flow works: register/login, create folders/artifacts, share publicly
- Using Selaras for UI components
- SQLite + local filesystem storage by default
- Private by default, public sharing supported
