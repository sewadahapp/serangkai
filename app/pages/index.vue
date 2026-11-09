<template>
  <div class="space-y-16 md:space-y-24">
    <section class="grid items-center gap-10 pt-4 md:pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div>
        <p class="serangkai-eyebrow">Self-hosted · Private by default</p>
        <h1 class="serangkai-balance mt-3 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.25rem]">
          An artifact workspace your agents can actually write to.
        </h1>
        <p class="serangkai-pretty mt-5 max-w-xl text-lg leading-relaxed text-[var(--selaras-resolved-text-muted)]">
          Serangkai keeps Markdown, HTML, PDFs, images, and static bundles in one organized home — with MCP and REST APIs so AI agents can create, version, and share them safely.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <SButton :to="loggedIn ? '/workspace' : '/auth/login'" size="lg">
            {{ loggedIn ? 'Open workspace' : 'Log in' }}
          </SButton>
          <SButton to="/agent" size="lg" variant="outline">Connect an agent</SButton>
        </div>

        <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--selaras-resolved-text-muted)]">
          <li v-for="fact in facts" :key="fact" class="flex items-center gap-2">
            <span class="size-1.5 rounded-full bg-[var(--selaras-resolved-color-primary-indicator)]" aria-hidden="true" />
            {{ fact }}
          </li>
        </ul>
      </div>

      <div class="serangkai-panel overflow-hidden shadow-[var(--selaras-resolved-shadow-lg)]">
        <div class="flex items-center gap-2 border-b border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] px-4 py-3">
          <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-color-danger-indicator)]" aria-hidden="true" />
          <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-color-warning-indicator)]" aria-hidden="true" />
          <span class="size-2.5 rounded-full bg-[var(--selaras-resolved-color-success-indicator)]" aria-hidden="true" />
          <span class="ms-2 font-mono text-xs text-[var(--selaras-resolved-text-muted)]">workspace · weekly-report.md</span>
        </div>
        <div class="space-y-4 p-6">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-[var(--selaras-resolved-text-muted)]">Agent → workspace</p>
            <SerangkaiCode :code="agentExample" language="http" :show-header="false" />
          </div>
          <div class="flex flex-wrap items-center gap-2 border-t border-[var(--selaras-resolved-border-muted)] pt-4 text-xs">
            <SBadge label="private" variant="subtle" color="neutral" size="sm" />
            <SBadge label="version 3" variant="subtle" color="primary" size="sm" />
            <SBadge label="signed link" variant="subtle" color="accent" size="sm" />
            <span class="text-[var(--selaras-resolved-text-muted)]">created by an agent, reviewed by you</span>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="capabilities">
      <div class="max-w-2xl">
        <p class="serangkai-eyebrow">Capabilities</p>
        <h2 id="capabilities" class="serangkai-balance mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything a workspace needs, without the platform lock-in.
        </h2>
      </div>

      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="feature in features" :key="feature.title" class="serangkai-panel p-5 transition-shadow hover:shadow-[var(--selaras-resolved-shadow-md)]">
          <h3 class="font-semibold">{{ feature.title }}</h3>
          <p class="mt-1.5 text-sm leading-relaxed text-[var(--selaras-resolved-text-muted)]">{{ feature.description }}</p>
        </article>
      </div>
    </section>

    <section class="serangkai-panel overflow-hidden" aria-labelledby="agent-setup">
      <div class="grid gap-8 p-6 md:p-10 lg:grid-cols-2">
        <div>
          <p class="serangkai-eyebrow">Agent-ready</p>
          <h2 id="agent-setup" class="serangkai-balance mt-2 text-2xl font-semibold tracking-tight">Three steps to your first agent artifact.</h2>
          <ol class="mt-6 space-y-4">
            <li v-for="(step, index) in steps" :key="step.title" class="flex gap-3">
              <span class="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--selaras-resolved-color-primary-subtle)] text-xs font-semibold text-[var(--selaras-resolved-color-primary-on-subtle)]">{{ index + 1 }}</span>
              <div>
                <p class="text-sm font-medium">{{ step.title }}</p>
                <p class="mt-0.5 text-sm text-[var(--selaras-resolved-text-muted)]">{{ step.detail }}</p>
              </div>
            </li>
          </ol>
        </div>

        <div class="rounded-lg border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] p-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--selaras-resolved-text-muted)]">MCP client</p>
          <SerangkaiCode :code="mcpSnippet" language="json" filename="mcp.json" />
          <div class="mt-4 border-t border-[var(--selaras-resolved-border-muted)] pt-3 text-xs text-[var(--selaras-resolved-text-muted)]">
            Read, write, and full scopes keep a leaked token from escalating.
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col items-start justify-between gap-6 rounded-lg bg-[var(--selaras-resolved-surface-inverted)] p-8 text-[var(--selaras-resolved-text-inverted)] sm:flex-row sm:items-center md:p-10">
      <div>
        <h2 class="text-xl font-semibold tracking-tight sm:text-2xl">Run it yourself in one container.</h2>
        <p class="mt-1.5 max-w-xl text-sm opacity-80">SQLite and the filesystem by default, with portable adapters when you need them. No external services required.</p>
      </div>
      <SButton :to="loggedIn ? '/workspace' : '/auth/login'" size="lg">Get started</SButton>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Serangkai — artifact and knowledge workspace' })

const { loggedIn } = useUserSession()

const facts = ['Single container', 'SQLite + filesystem', 'MCP + REST', 'Signed unlisted links']

const features = [
  { title: 'Organized like a workspace', description: 'Nested folders, artifact counts, scoped search, and subfolder moves that keep paths consistent.' },
  { title: 'Beautiful Markdown by default', description: 'Markdown renders with Mermaid diagrams and data charts using the workspace theme — no custom CSS from agents.' },
  { title: 'Versioned, never destructive', description: 'Every save appends a version. Restoring old content creates a new version instead of rewriting history.' },
  { title: 'Private until you decide', description: 'Artifacts are private by default. Unlisted links are signed; duplicate copies always start private.' },
  { title: 'Safe for untrusted content', description: 'HTML and bundle delivery run under sandbox CSPs. No server-side execution of uploaded code.' },
  { title: 'Portable by design', description: 'Nitro presets for Node, Cloudflare Workers, and Vercel, with durable storage adapters for each.' },
]

const steps = [
  { title: 'Create a scoped token', detail: 'Settings → API tokens. Give agents read or write, and keep full for yourself.' },
  { title: 'Point the agent at /api/mcp', detail: 'Streamable HTTP with a bearer header. Seven tools cover folders, artifacts, and search.' },
  { title: 'Review what it wrote', detail: 'Every artifact lands private, with a version trail you can read, restore, or share deliberately.' },
]

const mcpSnippet = `{
  "mcpServers": {
    "serangkai": {
      "type": "http",
      "url": "https://your-host/api/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}`

const agentExample = `POST /api/artifacts
Authorization: Bearer <scoped-token>

{ "title": "Weekly report",
  "type": "markdown",
  "content": "# Ship log\\n…" }`
</script>
