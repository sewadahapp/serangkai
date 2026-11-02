# AGENTS.md

Guidelines for AI agents working on Serangkai.

## Project
Serangkai is a production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans. It combines the organization of Notion, the interactive artifact capabilities of Claude Artifacts, and simplicity of lightweight self-hosted apps.

## Technology Stack
- **Framework**: Nuxt 4 + TypeScript + Bun
- **UI/Styling**: `@sewadah/selaras` for UI, layouts, and document styling
- **Markdown**: Nuxt Content/MDC-compatible rendering with Mermaid and TanStack Charts
- **Backend**: Nuxt/Nitro for server routes, REST APIs, MCP integration
- **Storage**: SQLite + local filesystem by default, with portable storage adapters for serverless
- **Deployment**: Docker (primary), InstaCloud, then Cloudflare Workers/Vercel

## Core Principles
- **Agent-first**: Agents create/update/publish via MCP and REST APIs
- **Human-friendly**: Polished web UI for browsing, organizing, sharing
- **Beautiful by default**: Markdown renders nicely with Selaras styling without HTML/CSS from agents
- **Private by default**: Artifacts owned by creator, explicit opt-in for public sharing
- **Security-first**: Treat authz, untrusted JS execution, private delivery as critical
- **Simple deployment**: Single container, no external deps required by default
- **Portable**: Storage adapters for different platforms

## Development
- Use Bun as runtime/package manager
- Follow Nuxt 4 conventions
- Keep it simple, avoid over-abstraction
- Write tests for critical functionality
- Commit meaningful progress regularly

## Documentation
Maintain: AGENTS.md, ARCHITECTURE.md, PROGRESS.md

## Security Notes
- Isolate untrusted HTML/JS execution (sandboxed iframes, CSP)
- Auth required for writes; scoped API tokens for agents
- Private artifacts must not be accessible without auth/permission
- No secrets in code/logs
- Review security-critical changes carefully
