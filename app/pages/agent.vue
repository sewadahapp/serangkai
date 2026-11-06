<template>
  <div class="space-y-6">
    <SerangkaiPageHeader title="Connect an agent" description="Agents use scoped API tokens against the REST API or the MCP endpoint.">
      <template #actions>
        <SButton v-if="user" to="/settings" variant="outline" icon="lucide:key-round">Manage tokens</SButton>
      </template>
    </SerangkaiPageHeader>

    <SAlert v-if="!user" color="info" variant="subtle" title="Sign in to generate tokens" description="You can read the reference now; token creation requires an account." />

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div class="space-y-6">
        <section class="serangkai-panel p-5" aria-labelledby="endpoints">
          <h2 id="endpoints" class="text-sm font-semibold">Endpoints</h2>
          <p class="mt-1 text-sm text-[var(--selaras-resolved-text-muted)]">Send the token as a bearer credential. Never commit tokens to a repository.</p>
          <div class="mt-3 space-y-2">
            <SFormField label="MCP">
              <SInput :model-value="mcpUrl" readonly aria-label="MCP endpoint" icon="lucide:plug" class="w-full font-mono text-xs" />
            </SFormField>
            <SFormField label="REST">
              <SInput :model-value="restUrl" readonly aria-label="REST endpoint" icon="lucide:code" class="w-full font-mono text-xs" />
            </SFormField>
          </div>
        </section>

        <section class="serangkai-panel overflow-hidden" aria-labelledby="mcp-config">
          <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
            <h2 id="mcp-config" class="text-sm font-semibold">MCP client configuration</h2>
          </div>
          <div class="p-5">
            <p class="text-sm text-[var(--selaras-resolved-text-muted)]">For clients that support Streamable HTTP MCP servers. Replace the token with one you just created.</p>
            <SerangkaiCode class="mt-3" :code="mcpConfig" language="json" filename="mcp.json" />
          </div>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="publishing">
          <h2 id="publishing" class="text-sm font-semibold">Publishing safely</h2>
          <ul class="mt-3 space-y-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">Read before you write.</strong>
              Call <code>get_artifact</code>, keep the content, then publish with
              <code>baseVersion</code> set to the version you read.
            </li>
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">Stale writes are refused.</strong>
              If someone else published in the meantime, the call fails and names the
              current version. Re-read, merge, and publish again — nothing is overwritten.
            </li>
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">No-op writes create nothing.</strong>
              Publishing identical content reports <code>versionCreated: false</code>.
            </li>
          </ul>
          <SerangkaiCode class="mt-3" :code="publishExample" language="bash" />
        </section>

        <section class="serangkai-panel overflow-hidden" aria-labelledby="rest-examples">
          <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
            <h2 id="rest-examples" class="text-sm font-semibold">REST examples</h2>
          </div>
          <div class="p-5">
            <SerangkaiCode :code="restExample" language="bash" />
            <p class="mt-3 text-sm text-[var(--selaras-resolved-text-muted)]">
              Artifacts are private by default. Set <code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1 py-0.5 font-mono text-xs">visibility</code> deliberately — unlisted links also require the signed key.
            </p>
          </div>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="serangkai-panel p-5" aria-labelledby="color-mode">
          <h2 id="color-mode" class="text-sm font-semibold">Color mode</h2>
          <p class="mt-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            HTML artifacts follow the viewer's light or dark preference automatically.
            Write standard CSS — the host injects a small bridge.
          </p>
          <SerangkaiCode class="mt-2" :code="colorModeExample" language="css" :show-header="false" />
          <p class="mt-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            To pin one scheme, declare
            <code>&lt;meta name="color-scheme" content="only light"&gt;</code>.
          </p>
        </section>
        <section class="serangkai-panel p-5" aria-labelledby="tools">
          <h2 id="tools" class="text-sm font-semibold">MCP tools</h2>
          <ul class="mt-3 space-y-1.5">
            <li v-for="tool in toolList" :key="tool.name" class="text-sm">
              <code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1.5 py-0.5 font-mono text-xs">{{ tool.name }}</code>
              <span class="ms-1.5 text-[var(--selaras-resolved-text-muted)]">{{ tool.hint }}</span>
            </li>
          </ul>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="scopes">
          <h2 id="scopes" class="text-sm font-semibold">Scopes</h2>
          <dl class="mt-3 space-y-3 text-sm">
            <div v-for="scope in scopeList" :key="scope.name">
              <dt><code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1.5 py-0.5 font-mono text-xs">{{ scope.name }}</code></dt>
              <dd class="mt-1 text-[var(--selaras-resolved-text-muted)]">{{ scope.hint }}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Connect an agent · Serangkai' })

const user = useState<any>('user')

const origin = computed(() => (import.meta.client ? window.location.origin : ''))
const mcpUrl = computed(() => `${origin.value}/api/mcp`)
const restUrl = computed(() => `${origin.value}/api/artifacts`)

const toolList = [
  { name: 'list_folders', hint: 'Folder tree' },
  { name: 'search', hint: 'Artifacts and folders' },
  { name: 'create_folder', hint: 'Nested folders' },
  { name: 'list_artifacts', hint: 'Owned artifacts' },
  { name: 'get_artifact', hint: 'Read source' },
  { name: 'create_artifact', hint: 'Private by default' },
  { name: 'update_artifact', hint: 'Publish a version — needs baseVersion for content' },
]

const scopeList = [
  { name: 'read', hint: 'List and read artifacts, folders, and versions.' },
  { name: 'write', hint: 'Create, update, move, restore, and delete.' },
  { name: 'full', hint: 'Everything, plus minting and revoking tokens.' },
]

const mcpConfig = computed(() => JSON.stringify({
  mcpServers: {
    serangkai: {
      type: 'http',
      url: mcpUrl.value,
      headers: { Authorization: 'Bearer YOUR_TOKEN' },
    },
  },
}, null, 2))

const publishExample = `# 1. read
get_artifact({ id: "abc" })          → { content: "...", version: 3 }

# 2. publish what you read
update_artifact({ id: "abc", content: "...", baseVersion: 3 })
  → { version: 4, versionCreated: true }

# stale baseVersion comes back as an error naming the current version`

const colorModeExample = `:root {
  color-scheme: light dark;
}
body {
  background:
    light-dark(#fff, #101014);
  color:
    light-dark(#111, #f5f5f5);
}`

const restExample = computed(() => `curl -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  ${restUrl.value}

curl -X POST -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Weekly report","type":"markdown","content":"# Report"}' \\
  ${restUrl.value}`)
</script>
