# Serangkai Architecture

## Overview
Serangkai is a Nuxt 4 application providing artifact storage, organization, and sharing for AI agents and humans.

## Technology Stack
- **Frontend/Framework**: Nuxt 4, Vue 3, TypeScript
- **UI Components**: @sewadah/selaras
- **Content**: @nuxt/content with MDC for Markdown rendering
- **Charts/Diagrams**: Mermaid, @tanstack/vue-charts (or similar)
- **Backend**: Nuxt Nitro server routes
- **Database**: better-sqlite3 with drizzle-orm (or knex) - SQLite by default
- **Storage**: Local filesystem with adapter pattern for portability
- **Auth**: Session-based auth + API tokens
- **MCP**: @modelcontextprotocol/sdk or custom implementation

## System Design

### Data Model
```typescript
User {
  id: string (uuid)
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

ApiToken {
  id: string
  userId: string
  name: string
  tokenHash: string (store hash only)
  scopes: string[] // ['read', 'write', 'publish']
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

Folder {
  id: string
  userId: string
  parentId: string | null
  name: string
  path: string // computed path for quick lookup
  createdAt: Date
  updatedAt: Date
}

Artifact {
  id: string
  userId: string
  folderId: string | null
  slug: string // URL-friendly unique identifier per user or globally?
  title: string
  type: 'markdown' | 'html' | 'javascript' | 'pdf' | 'image' | 'json' | 'bundle'
  visibility: 'private' | 'public' | 'unlisted'
  contentPath: string // path to file in storage
  metadata: JSON
  createdAt: Date
  updatedAt: Date
}

ArtifactVersion {
  id: string
  artifactId: string
  version: number
  contentPath: string
  metadata: JSON
  createdAt: Date
}
```

### Storage Layer
Abstract storage interface to support multiple backends:
```typescript
interface StorageAdapter {
  save(key: string, data: Buffer | string): Promise<string>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getUrl?(key: string): Promise<string> // for presigned URLs if needed
}
```
Implementations: LocalStorageAdapter (default), S3StorageAdapter (future), etc.

### API Routes (Nitro)
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `POST /api/tokens` - Create API token
- `GET /api/tokens` - List tokens
- `DELETE /api/tokens/:id` - Revoke token
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder
- `GET /api/artifacts` - List artifacts (with filters)
- `POST /api/artifacts` - Create artifact
- `GET /api/artifacts/:id` - Get artifact
- `PUT /api/artifacts/:id` - Update artifact
- `DELETE /api/artifacts/:id` - Delete artifact
- `GET /api/artifacts/:id/versions` - Version history
- `GET /api/artifacts/:id/versions/:version` - Get specific version
- `POST /api/artifacts/:id/publish` - Publish/share controls
- `GET /api/search` - Search artifacts/folders

### MCP Integration
MCP server at `/mcp` or similar endpoint providing tools:
- `list_artifacts` - List user's artifacts
- `get_artifact` - Read artifact content
- `create_artifact` - Create new artifact
- `update_artifact` - Update existing artifact
- `create_folder` - Create folder
- `search` - Search workspace

### Frontend Routes
- `/` - Dashboard/workspace home
- `/login`, `/register` - Auth pages
- `/workspace` or `/` - Main workspace view with folders
- `/artifacts/[id]` - Artifact view/edit
- `/share/[slug]` - Public/shared artifact view
- `/settings` - User settings, tokens

### Security Considerations
- **Auth**: Secure password hashing (argon2/bcrypt), HttpOnly secure cookies for sessions
- **API Tokens**: Hashed with SHA-256 or similar, prefixed for identification
- **Authorization**: All private resources check ownership; API tokens checked for scopes
- **XSS/Sanitization**: Sanitize user input; careful with HTML rendering
- **Sandboxing**: HTML/JS artifacts rendered in sandboxed iframes with restrictive CSP
- **File Uploads**: Validate file types, size limits, scan if needed
- **Rate Limiting**: On auth endpoints and API
- **CSP**: Content Security Policy headers
- **Private Content**: Never leak private artifacts in public endpoints

## Deployment
- **Docker**: Single container with volume for /data (SQLite DB + files)
- **Environment Variables**: Config via env vars
- **Ports**: Expose 3000 by default
- **Healthcheck**: /api/health endpoint
