<template>
  <div class="agent-page">
    <SerangkaiPageHeader title="Connect an agent" description="Let your agent create, find, and update rangka in Serangkai." class="!mb-0">
      <template v-if="loggedIn" #actions>
        <SButton to="/settings?tab=tokens" variant="ghost" color="neutral" icon="lucide:key-round">Manage tokens</SButton>
      </template>
    </SerangkaiPageHeader>

    <!-- Two ways to connect, as top-level pill tabs: hand a prompt to the
         agent (default), or follow the manual steps. Pills keep this level
         visually distinct from the underline method tabs inside Manual. -->
    <STabs :items="setupModes" default-value="agent" variant="pill" class="agent-modes" :ui="{ list: { 'aria-label': 'Setup method', class: 'w-fit max-w-full' }, trigger: 'whitespace-nowrap px-2.5 sm:px-3', content: 'pt-4' }">
      <template #agent>
      <SCard class="agent-path agent-path-agent" :ui="{ body: 'p-5 sm:p-6 flex h-full flex-col' }" aria-labelledby="agent-path-title">
        <p class="agent-path-kicker"><SIcon name="lucide:bot" class="size-4" aria-hidden="true" />Recommended</p>
        <h2 id="agent-path-title" class="agent-section-title mt-2">Let your agent set it up</h2>
        <p class="agent-description mt-1">Paste this into Claude Code, Cursor, Codex, or any MCP-capable agent. It adds Serangkai and checks the connection.</p>
        <pre class="agent-prompt-box" tabindex="0" aria-label="Setup prompt">{{ setupPrompt }}</pre>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <SerangkaiCopyButton :value="setupPrompt" label="setup prompt" text="Copy setup prompt" size="md" />
          <span class="agent-caption">You'll approve access in your browser.</span>
        </div>
      </SCard>
      </template>

      <template #manual>
      <SCard class="agent-path" :ui="{ body: 'p-5 sm:p-6' }" aria-labelledby="manual-path-title">
        <h2 id="manual-path-title" class="agent-section-title">Set it up yourself</h2>
        <p class="agent-description mt-1">Use MCP with a compatible agent, or the REST API from your own scripts.</p>
        <div class="mt-4 grid min-w-0 gap-3">
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

        <STabs :items="connectionOptions" default-value="browser" variant="underline" class="mt-6" :ui="{ list: { 'aria-label': 'Connection method' }, content: 'pt-5' }">
          <template #browser>
            <section aria-labelledby="oauth-connection" class="agent-tab-content">
              <div>
                <h3 id="oauth-connection" class="agent-subsection-title">Connect with browser sign-in</h3>
                <p class="agent-description mt-1">For MCP clients that support OAuth. No token to copy.</p>
              </div>
              <ol class="agent-instructions">
                <li><span class="agent-step" aria-hidden="true">1</span><div><h4>Add Serangkai to your client</h4><p>Choose a remote MCP connection and paste the MCP endpoint above.</p></div></li>
                <li><span class="agent-step" aria-hidden="true">2</span><div><h4>Sign in and approve access</h4><p>Your client opens Serangkai in a browser. Choose the read and write permissions your agent needs.</p></div></li>
              </ol>
              <p class="agent-caption">Disconnect agents in <NuxtLink to="/settings?tab=agents" class="agent-link">Settings → Connected agents</NuxtLink>. Remote MCP connections require HTTPS; localhost also supports HTTP.</p>
            </section>
          </template>
          <template #token>
            <section aria-labelledby="mcp-config" class="agent-tab-content">
              <div>
                <h3 id="mcp-config" class="agent-subsection-title">MCP client configuration</h3>
                <p class="agent-description mt-1">For clients that support Streamable HTTP MCP servers. Replace the token with one you just created.</p>
                <SerangkaiCode class="mt-3" :code="mcpConfig" language="json" filename="mcp.json" />
              </div>
              <p class="agent-caption">Create a token in <NuxtLink to="/settings?tab=tokens" class="agent-link">Settings → Tokens</NuxtLink> with <code>read</code> and <code>write</code> for editing, or just <code>read</code> for browsing. Keep tokens out of source control.</p>
            </section>
          </template>
          <template #rest>
            <section aria-labelledby="rest-examples" class="agent-tab-content">
              <div>
                <h3 id="rest-examples" class="agent-subsection-title">REST examples</h3>
                <p class="agent-description mt-1">Use a scoped API token as a bearer credential to list or create rangka.</p>
                <SerangkaiCode class="mt-3" :code="restExample" language="bash" />
              </div>
              <p class="agent-caption">Rangka are private by default. Set <code>visibility</code> deliberately; unlisted links also require the signed key.</p>
            </section>
          </template>
        </STabs>
      </SCard>
      </template>
    </STabs>

    <SCard variant="soft" :ui="{ body: 'p-4 sm:p-5' }" aria-labelledby="try-connection">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 id="try-connection" class="text-sm font-semibold">Then try it</h2>
          <p class="agent-caption mt-0.5">Once connected, give your agent a first task.</p>
        </div>
        <SerangkaiCopyButton :value="starterPrompt" label="starter prompt" />
      </div>
      <p class="agent-prompt">{{ starterPrompt }}</p>
    </SCard>

    <section class="serangkai-card" aria-labelledby="reference-title">
      <header class="serangkai-card-head">
        <div>
          <h2 id="reference-title" class="agent-section-title">Reference</h2>
          <p class="agent-description mt-0.5">Tools, permissions, and authoring conventions.</p>
        </div>
        <SerangkaiCopyButton :value="referenceForAgent" label="all for agent" text="Copy all for agent" variant="outline" color="neutral" />
      </header>
      <SAccordion :items="referenceSections" type="multiple" color="neutral" :ui="{ item: 'px-5 max-sm:px-4', contentInner: 'pb-5', trigger: 'py-4' }">
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

const setupModes = [
  { label: 'Use your agent', value: 'agent', icon: 'lucide:bot' },
  { label: 'Manual setup', value: 'manual', icon: 'lucide:wrench' },
]
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
  { name: 'set_connection_name', hint: 'Name this connection in Settings' },
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

// What the user pastes into their agent. Only states what the server
// supports: Streamable HTTP, OAuth browser sign-in, bearer-token fallback.
const setupPrompt = computed(() => `Connect to my Serangkai workspace over MCP.

- Server name: serangkai
- URL: ${mcpUrl.value}
- Transport: Streamable HTTP
- Auth: OAuth browser sign-in. If your client can't do OAuth, ask me for an API token and send it as the header "Authorization: Bearer <token>".

Add it using your own client's MCP configuration. After I approve access in the browser:

1. Call set_connection_name with "<your app> – <this computer's hostname> – <your OS username>", so I can tell this connection apart from others in Settings. Leave out any part you can't determine.
2. Call get_rangka_capabilities and tell me which formats you can publish.`)

// The whole Reference section as one Markdown block an agent can keep as
// guidance. Built from the same lists and examples the page shows.
const referenceForAgent = computed(() => [
  '# Serangkai: guidance for agents',
  '',
  `MCP endpoint: ${mcpUrl.value}`,
  `REST endpoint: ${restUrl.value}`,
  '',
  '## MCP tools',
  ...toolList.map(tool => `- \`${tool.name}\`: ${tool.hint}`),
  '',
  '## Permissions',
  ...scopeList.map(scope => `- \`${scope.name}\`: ${scope.hint}`),
  'Browser-approved clients can receive `read` and `write`, never `full`.',
  '',
  '## Publishing and version history',
  'Read with `get_rangka`, then publish with `baseVersion` set to the version you read. If another writer saved first, re-read, merge, and publish again. Publishing identical content reports `versionCreated: false`.',
  '',
  '```',
  publishExample,
  '```',
  '',
  '## HTML color mode',
  'HTML rangka follow the viewer\'s light or dark preference automatically. Use standard CSS; Serangkai supplies the color-mode bridge. To pin one scheme, declare `<meta name="color-scheme" content="only light">`.',
  '',
  '```css',
  colorModeExample,
  '```',
  '',
  '## HTML diagrams and charts',
  'Add a `.mermaid` block or a JSON chart marker. Serangkai loads the matching runtime locally; no CDN or author JavaScript is needed.',
  '',
  '```html',
  htmlDiagramExample,
  '```',
  '',
  'Rangka are private by default. Set `visibility` deliberately.',
].join('\n'))

const restExample = computed(() => `curl -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  ${restUrl.value}

curl -X POST -H "Authorization: Bearer $SERANGKAI_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Weekly report","type":"markdown","content":"# Report"}' \\
  ${restUrl.value}`)
</script>

<style scoped>
/* Width comes from the shared page column in the layout. */
.agent-page { display: flex; flex-direction: column; gap: 2rem; }
.agent-section-title { font-size: 1rem; font-weight: 650; line-height: 1.5; letter-spacing: -.02em; }
.agent-subsection-title { font-size: .9375rem; font-weight: 600; line-height: 1.5; }

.agent-modes { min-width: 0; }
.agent-path { min-width: 0; }
.agent-path-agent { border-color: var(--selaras-resolved-color-primary-border); }
.agent-path-kicker { display: inline-flex; align-items: center; gap: .375rem; font-size: .75rem; font-weight: 600; color: var(--selaras-resolved-color-primary-text); }
.agent-prompt-box { margin-top: 1rem; max-height: 20rem; overflow: auto; overscroll-behavior: contain; padding: .875rem 1rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-md); background: var(--selaras-resolved-surface-elevated); font-family: var(--font-mono); font-size: .75rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--selaras-resolved-text-default); }
.agent-prompt-box:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: 2px; }
.agent-link { color: var(--selaras-resolved-text-default); text-decoration: underline; text-underline-offset: 3px; }
.agent-description { color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.75; }
.agent-caption { color: var(--selaras-resolved-text-muted); font-size: .75rem; line-height: 1.6; }
.agent-tab-content { display: flex; min-width: 0; flex-direction: column; gap: 1.25rem; }
.agent-setup { min-width: 0; }
.agent-instructions { display: flex; flex-direction: column; gap: 1.25rem; }
.agent-instructions li { display: flex; gap: .875rem; align-items: start; }
.agent-step { display: grid; width: 1.75rem; height: 1.75rem; flex-shrink: 0; place-items: center; border: 1px solid var(--selaras-resolved-border-default); border-radius: 50%; color: var(--selaras-resolved-text-muted); font-size: .75rem; }
.agent-instructions h4 { padding-top: .125rem; font-size: .875rem; font-weight: 600; }
.agent-instructions p { margin-top: .25rem; color: var(--selaras-resolved-text-muted); font-size: .875rem; line-height: 1.7; }
.agent-prompt { margin-top: .5rem; font-size: .875rem; line-height: 1.75; }
.agent-reference-list { display: grid; gap: .875rem; font-size: .875rem; }
.agent-reference-list > div { display: grid; min-width: 0; gap: .375rem; }
.agent-reference-list dd { color: var(--selaras-resolved-text-muted); line-height: 1.6; }
.agent-page :not(pre) > code { overflow-wrap: anywhere; border-radius: .25rem; background: var(--selaras-resolved-surface-elevated); padding: .125rem .3rem; font-family: var(--font-mono); font-size: .8em; color: var(--selaras-resolved-text-default); }
@media (min-width: 640px) { .agent-reference-list > div { grid-template-columns: minmax(0, 14rem) minmax(0, 1fr); gap: 1.5rem; } }
</style>
