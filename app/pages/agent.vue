<template>
  <div class="agent-page">
    <header class="agent-heading">
      <div class="min-w-0">
        <h1>Connect an agent</h1>
        <p>Let your agent create, find, and update rangka in Serangkai.</p>
      </div>
      <SButton v-if="loggedIn" to="/settings" variant="ghost" color="neutral" icon="lucide:key-round">Manage tokens</SButton>
    </header>

    <SCard :ui="{ body: 'p-5 sm:p-6' }" aria-labelledby="endpoints">
      <h2 id="endpoints" class="agent-section-title">Your workspace endpoints</h2>
      <p class="agent-description mt-1">Use MCP with a compatible agent, or the REST API from your own scripts.</p>
      <div class="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <SFormField label="MCP" class="min-w-0">
          <SInput :model-value="mcpUrl" readonly aria-label="MCP endpoint" icon="lucide:plug" class="w-full font-mono text-xs">
            <template #trailing="{ buttonSize }"><SerangkaiCopyButton :value="mcpUrl" label="MCP endpoint" :size="buttonSize" /></template>
          </SInput>
        </SFormField>
        <SFormField label="REST API" class="min-w-0">
          <SInput :model-value="restUrl" readonly aria-label="REST endpoint" icon="lucide:code" class="w-full font-mono text-xs">
            <template #trailing="{ buttonSize }"><SerangkaiCopyButton :value="restUrl" label="REST endpoint" :size="buttonSize" /></template>
          </SInput>
        </SFormField>
      </div>
    </SCard>

    <section aria-label="Connection setup" class="agent-setup">
      <STabs :items="connectionOptions" default-value="browser" variant="underline" :ui="{ list: { 'aria-label': 'Connection method' }, content: 'pt-6' }">
        <template #browser>
          <section aria-labelledby="oauth-connection" class="agent-tab-content">
            <div>
              <h2 id="oauth-connection" class="agent-section-title">Connect with browser sign-in</h2>
              <p class="agent-description mt-2">For MCP clients that support OAuth. Connect your workspace without copying a token.</p>
            </div>
            <ol class="agent-instructions">
              <li><span class="agent-step" aria-hidden="true">1</span><div><h3>Add Serangkai to your client</h3><p>Choose a remote MCP connection and paste your MCP endpoint above.</p></div></li>
              <li><span class="agent-step" aria-hidden="true">2</span><div><h3>Sign in and approve access</h3><p>Your client opens Serangkai in a browser. Choose the read and write permissions your agent needs.</p></div></li>
            </ol>
            <p class="agent-description">You can disconnect an agent in <SButton to="/settings" variant="link" color="neutral" size="sm" :ui="{ base: 'h-auto p-0 text-sm underline underline-offset-4' }">Settings → Connected agents</SButton>.</p>
            <p class="agent-caption">Remote MCP connections require HTTPS. Localhost also supports HTTP.</p>
          </section>
        </template>
        <template #token>
          <section aria-labelledby="mcp-config" class="agent-tab-content">
            <div>
              <h2 id="mcp-config" class="agent-section-title">MCP client configuration</h2>
              <p class="agent-description mt-2">For clients that support Streamable HTTP MCP servers. Replace the token with one you just created.</p>
              <SerangkaiCode class="mt-4" :code="mcpConfig" language="json" filename="mcp.json" />
            </div>
            <p class="agent-description">Create a token in Settings with <code>read</code> and <code>write</code> for editing, or just <code>read</code> for browsing. Keep tokens out of source control.</p>
          </section>
        </template>
        <template #rest>
          <section aria-labelledby="rest-examples" class="agent-tab-content">
            <div>
              <h2 id="rest-examples" class="agent-section-title">REST examples</h2>
              <p class="agent-description mt-2">Use a scoped API token as a bearer credential to list or create rangka.</p>
              <SerangkaiCode class="mt-4" :code="restExample" language="bash" />
            </div>
            <p class="agent-description">Rangka are private by default. Set <code>visibility</code> deliberately; unlisted links also require the signed key.</p>
          </section>
        </template>
      </STabs>
    </section>

    <SCard variant="soft" :ui="{ body: 'p-4 sm:p-5' }" aria-labelledby="try-connection">
      <div class="flex items-center justify-between gap-3">
        <h2 id="try-connection" class="text-sm font-semibold">Try it with your agent</h2>
        <SerangkaiCopyButton :value="starterPrompt" label="starter prompt" />
      </div>
      <p class="agent-prompt">{{ starterPrompt }}</p>
    </SCard>

    <section class="agent-reference" aria-labelledby="reference-title">
      <h2 id="reference-title" class="agent-section-title">Reference</h2>
      <SAccordion :items="referenceSections" type="multiple" color="neutral" class="mt-3" :ui="{ contentInner: 'pb-5', trigger: 'py-4' }">
        <template #tools>
          <dl class="agent-reference-list">
            <div v-for="tool in toolList" :key="tool.name"><dt><code>{{ tool.name }}</code></dt><dd>{{ tool.hint }}</dd></div>
          </dl>
        </template>
        <template #scopes>
          <dl class="agent-reference-list">
            <div v-for="scope in scopeList" :key="scope.name"><dt><code>{{ scope.name }}</code></dt><dd>{{ scope.hint }}</dd></div>
          </dl>
          <p class="agent-description mt-4">Browser-approved clients can receive <code>read</code> and <code>write</code>, never <code>full</code>. Use Settings to revoke access.</p>
        </template>
        <template #publishing>
          <section id="publishing" class="agent-tab-content">
            <p class="agent-description">Read with <code>get_rangka</code>, then publish with <code>baseVersion</code> set to the version you read. If another writer saved first, re-read, merge, and publish again.</p>
            <SerangkaiCode :code="publishExample" language="bash" />
            <p class="agent-description">Publishing identical content reports <code>versionCreated: false</code> and keeps the existing history.</p>
          </section>
        </template>
        <template #color-mode>
          <section id="color-mode" class="agent-tab-content">
            <p class="agent-description">HTML rangka follow the viewer's light or dark preference automatically. Use standard CSS; Serangkai supplies the color-mode bridge.</p>
            <SerangkaiCode :code="colorModeExample" language="css" :show-header="false" />
            <p class="agent-description">To pin one scheme, declare <code>&lt;meta name="color-scheme" content="only light"&gt;</code>.</p>
          </section>
        </template>
        <template #html-diagrams>
          <section id="html-diagrams" class="agent-tab-content">
            <p class="agent-description">Add a <code>.mermaid</code> block or a JSON chart marker. Serangkai loads the matching runtime locally; no CDN or author JavaScript is needed for these diagrams and charts.</p>
            <SerangkaiCode :code="htmlDiagramExample" language="html" :show-header="false" />
          </section>
        </template>
      </SAccordion>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Connect an agent' })

const { loggedIn } = useUserSession()

const origin = useRequestURL().origin
const mcpUrl = computed(() => `${origin}/api/mcp`)
const restUrl = computed(() => `${origin}/api/rangka`)

const connectionOptions = [
  { label: 'Browser sign-in', value: 'browser' },
  { label: 'API token', value: 'token' },
  { label: 'REST API', value: 'rest' },
]
const referenceSections = [
  { label: 'MCP tools', value: 'tools' },
  { label: 'Permissions', value: 'scopes' },
  { label: 'Publishing & version history', value: 'publishing' },
  { label: 'HTML color mode', value: 'color-mode' },
  { label: 'HTML diagrams & charts', value: 'html-diagrams' },
]
const starterPrompt = 'Create a Markdown rangka in Serangkai called Project notes, and save a short project outline.'

const toolList = [
  { name: 'get_rangka_capabilities', hint: 'Discover supported formats and components' },
  { name: 'list_folders', hint: 'Folder tree' },
  { name: 'search', hint: 'Rangka and folders' },
  { name: 'create_folder', hint: 'Nested folders' },
  { name: 'list_rangka', hint: 'Owned rangka' },
  { name: 'get_rangka', hint: 'Read source' },
  { name: 'create_rangka', hint: 'Private by default' },
  { name: 'update_rangka', hint: 'Publish a version — needs baseVersion for content' },
]

const scopeList = [
  { name: 'read', hint: 'List and read rangka, folders, and versions.' },
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
get_rangka({ id: "abc" })          → { content: "...", version: 3 }

# 2. publish what you read
update_rangka({ id: "abc", content: "...", baseVersion: 3 })
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

const htmlDiagramExample = `<pre class="mermaid">flowchart LR
  Draft --> Review --> Share
</pre>

<script type="application/json" data-serangkai-chart>
{"type":"bar","data":[{"week":"W1","value":12}],
 "x":"week","y":"value"}
<\/script>`

const restExample = computed(() => `curl -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  ${restUrl.value}

curl -X POST -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Weekly report","type":"markdown","content":"# Report"}' \\
  ${restUrl.value}`)
</script>

<style scoped>
.agent-page { display: flex; flex-direction: column; gap: 2rem; max-width: 60rem; margin-inline: auto; }
.agent-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
.agent-heading h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.2; letter-spacing: -.035em; }
.agent-heading p { margin-top: .65rem; color: var(--selaras-resolved-text-muted); font-size: .9rem; line-height: 1.65; }
.agent-section-title { font-size: 1rem; font-weight: 650; line-height: 1.5; letter-spacing: -.02em; }
.agent-description { color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.75; }
.agent-caption { color: var(--selaras-resolved-text-muted); font-size: .75rem; line-height: 1.6; }
.agent-tab-content { display: flex; min-width: 0; flex-direction: column; gap: 1.25rem; }
.agent-setup { min-width: 0; }
.agent-instructions { display: flex; flex-direction: column; gap: 1.25rem; }
.agent-instructions li { display: flex; gap: .875rem; align-items: start; }
.agent-step { display: grid; width: 1.75rem; height: 1.75rem; flex-shrink: 0; place-items: center; border: 1px solid var(--selaras-resolved-border-default); border-radius: 50%; color: var(--selaras-resolved-text-muted); font-size: .75rem; }
.agent-instructions h3 { padding-top: .125rem; font-size: .875rem; font-weight: 600; }
.agent-instructions p { margin-top: .25rem; color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.7; }
.agent-prompt { margin-top: .5rem; font-size: .875rem; line-height: 1.75; }
.agent-reference { min-width: 0; padding-top: .5rem; }
.agent-reference-list { display: grid; gap: .875rem; font-size: .875rem; }
.agent-reference-list > div { display: grid; min-width: 0; gap: .375rem; }
.agent-reference-list dd { color: var(--selaras-resolved-text-muted); line-height: 1.6; }
.agent-page :not(pre) > code { overflow-wrap: anywhere; border-radius: .25rem; background: var(--selaras-resolved-surface-elevated); padding: .125rem .3rem; font-family: var(--font-mono); font-size: .8em; color: var(--selaras-resolved-text-default); }
@media (min-width: 640px) { .agent-reference-list > div { grid-template-columns: minmax(0, 14rem) minmax(0, 1fr); gap: 1.5rem; } }
</style>
