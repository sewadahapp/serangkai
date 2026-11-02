# Serangkai

A production-minded, open-source, self-hosted artifact and knowledge workspace for AI agents and humans.

## Features

- 🗂️ **Organized Workspace** - Nested folders, pages, and artifacts like Notion
- ✨ **Beautiful by Default** - Markdown renders with polished Selaras styling
- 🎨 **Interactive Artifacts** - Support for HTML, JavaScript, charts, diagrams, and web apps
- 🤖 **Agent-Ready** - MCP and REST APIs for AI agents to create and update artifacts
- 🔒 **Private by Default** - Artifacts are private to their creator with explicit public sharing
- 🚀 **Simple Self-Hosting** - Single container deployment with SQLite + local filesystem

## Quick Start with Docker

```bash
docker run -d -p 3000:3000 \
  -v serangkai-data:/app/data \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e NODE_ENV=production \
  ghcr.io/yourusername/serangkai:latest
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Connect an AI agent

Create a scoped token from the workspace API, then configure an MCP client with the
Streamable HTTP endpoint:

```bash
claude mcp add --transport http serangkai http://localhost:3000/api/mcp \
  --header "Authorization: Bearer $SERANGKAI_API_TOKEN" --scope user
```

Use a token with `read` scope for discovery and reading, or `read,write` for
creating and updating artifacts. Tokens are hashed at rest and can be revoked.

## Tech Stack

- [Nuxt 4](https://nuxt.com/) - Full-stack framework
- [TypeScript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/) - Runtime
- [@sewadah/selaras](https://selarasui.my.id/) - UI components and styling
- [Nuxt Content](https://content.nuxt.com/) - Markdown rendering
- [SQLite](https://www.sqlite.org/) + [Drizzle ORM](https://orm.drizzle.team/)
- [Nitro](https://nitro.unjs.io/) - Server engine

## License

MIT
