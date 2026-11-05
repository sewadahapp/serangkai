<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">Connect an agent</h1>
        <p class="mt-2 max-w-2xl text-muted-foreground">
          Agents use scoped API tokens against the REST API or the MCP endpoint. Give each agent the smallest scope it needs, and revoke the token when you are done.
        </p>
      </div>
      <SButton to="/settings" variant="outline">Manage tokens</SButton>
    </div>

    <SCard v-if="!user">
      <SCardHeader><SCardTitle>Sign in required</SCardTitle></SCardHeader>
      <SCardContent>
        <p class="mb-4 text-sm text-muted-foreground">Sign in to generate tokens and see your workspace endpoint.</p>
        <SButton to="/auth/login">Login</SButton>
      </SCardContent>
    </SCard>

    <template v-else>
      <SCard>
        <SCardHeader><SCardTitle>Endpoint</SCardTitle></SCardHeader>
        <SCardContent>
          <p class="mb-2 text-sm text-muted-foreground">Send the token as a bearer credential. Never commit tokens to a repository.</p>
          <input :value="mcpUrl" readonly aria-label="MCP endpoint" class="w-full rounded-md border bg-muted px-3 py-2 font-mono text-xs" />
          <input :value="restUrl" readonly aria-label="REST endpoint" class="mt-2 w-full rounded-md border bg-muted px-3 py-2 font-mono text-xs" />
        </SCardContent>
      </SCard>

      <SCard>
        <SCardHeader><SCardTitle>MCP client configuration</SCardTitle></SCardHeader>
        <SCardContent>
          <p class="mb-2 text-sm text-muted-foreground">
            Add this to a client that supports Streamable HTTP MCP servers. Replace the token with one you just created.
          </p>
          <pre class="overflow-auto rounded bg-muted p-4 text-xs">{{ mcpConfig }}</pre>
          <p class="mt-3 text-sm text-muted-foreground">
            Tools: <code>{{ tools.join(', ') }}</code>. Write tools require the <code>write</code> scope; read tools need <code>read</code>.
          </p>
        </SCardContent>
      </SCard>

      <SCard>
        <SCardHeader><SCardTitle>REST examples</SCardTitle></SCardHeader>
        <SCardContent>
          <pre class="overflow-auto rounded bg-muted p-4 text-xs">{{ restExample }}</pre>
          <p class="mt-3 text-sm text-muted-foreground">
            Artifacts are private by default. Set <code>visibility</code> to <code>unlisted</code> or <code>public</code> deliberately, and remember that unlisted links require the signed key.
          </p>
        </SCardContent>
      </SCard>

      <SCard>
        <SCardHeader><SCardTitle>Scopes</SCardTitle></SCardHeader>
        <SCardContent>
          <ul class="space-y-2 text-sm">
            <li><code>read</code> — list and read artifacts, folders, and versions.</li>
            <li><code>write</code> — create, update, move, restore, and delete artifacts and folders.</li>
            <li><code>full</code> — everything, plus minting and revoking tokens.</li>
          </ul>
        </SCardContent>
      </SCard>
    </template>
  </div>
</template>

<script setup lang="ts">
const user = useState('user')

const origin = computed(() => (import.meta.client ? window.location.origin : ''))
const mcpUrl = computed(() => `${origin.value}/api/mcp`)
const restUrl = computed(() => `${origin.value}/api/artifacts`)

const tools = ['list_folders', 'create_folder', 'list_artifacts', 'get_artifact', 'create_artifact', 'update_artifact']

const mcpConfig = computed(() => JSON.stringify({
  mcpServers: {
    serangkai: {
      type: 'http',
      url: mcpUrl.value,
      headers: { Authorization: 'Bearer YOUR_TOKEN' },
    },
  },
}, null, 2))

const restExample = computed(() => `curl -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  ${restUrl.value}

curl -X POST -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Weekly report","type":"markdown","content":"# Report"}' \\
  ${restUrl.value}`)
</script>
