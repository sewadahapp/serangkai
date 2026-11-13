<template>
  <div class="agent-page space-y-6">
    <header class="agent-heading">
      <div>
        <p class="agent-eyebrow"><SIcon name="lucide:bot" class="size-4" aria-hidden="true" /> AGENT CONNECTION</p>
        <h1>Connect an agent</h1>
        <p>Give your agent a way to create, find, and update work in your workspace.</p>
      </div>
      <SButton v-if="loggedIn" to="/settings" variant="outline" icon="lucide:key-round">Manage tokens</SButton>
    </header>

    <SAlert v-if="!loggedIn" color="info" variant="subtle" title="Sign in to generate tokens" description="You can read the reference now; token creation requires an account." />

    <section class="agent-start" aria-labelledby="start-title">
      <div class="agent-start-intro">
        <p class="agent-eyebrow">GET CONNECTED</p>
        <h2 id="start-title">A simple place to start.</h2>
        <p>Choose how your client connects, then give it only the access it needs.</p>
      </div>
      <div class="agent-steps">
        <div><span>01</span><p><strong>Choose a connection</strong><small>Use MCP or the REST API.</small></p></div>
        <div><span>02</span><p><strong>Authorize your agent</strong><small>Use a scoped token or browser sign-in for supported MCP clients.</small></p></div>
        <div><span>03</span><p><strong>Start making</strong><small>Create and organize rangka in your workspace.</small></p></div>
      </div>
    </section>

    <nav class="agent-jump" aria-label="Agent page sections">
      <span>ON THIS PAGE</span>
      <a href="#endpoints">Endpoints</a><a href="#mcp-config">MCP setup</a><a href="#oauth-connection">Browser sign-in</a><a href="#publishing">Publishing</a><a href="#tools">Tools &amp; scopes</a>
    </nav>

    <div class="agent-layout grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="min-w-0 space-y-6">
        <section class="agent-section serangkai-panel p-5 sm:p-6" aria-labelledby="endpoints">
          <p class="agent-section-label">01 / CONNECTION</p>
          <h2 id="endpoints" class="agent-section-title">Your endpoints</h2>
          <p class="mt-2 text-sm leading-relaxed text-[var(--selaras-resolved-text-muted)]">Send the token as a bearer credential. Never commit tokens to a repository.</p>
          <div class="mt-3 space-y-2">
            <SFormField label="MCP">
              <SInput :model-value="mcpUrl" readonly aria-label="MCP endpoint" icon="lucide:plug" class="w-full font-mono text-xs">
                <template #trailing="{ buttonSize }">
                  <SerangkaiCopyButton :value="mcpUrl" label="MCP endpoint" :size="buttonSize" />
                </template>
              </SInput>
            </SFormField>
            <SFormField label="REST">
              <SInput :model-value="restUrl" readonly aria-label="REST endpoint" icon="lucide:code" class="w-full font-mono text-xs">
                <template #trailing="{ buttonSize }">
                  <SerangkaiCopyButton :value="restUrl" label="REST endpoint" :size="buttonSize" />
                </template>
              </SInput>
            </SFormField>
          </div>
        </section>

        <section class="serangkai-panel overflow-hidden" aria-labelledby="mcp-config">
          <div class="border-b border-[var(--selaras-resolved-border-muted)] px-5 py-3">
            <p class="agent-section-label">02 / MCP</p><h2 id="mcp-config" class="agent-section-title">MCP client configuration</h2>
          </div>
          <div class="p-5">
            <p class="text-sm text-[var(--selaras-resolved-text-muted)]">For clients that support Streamable HTTP MCP servers. Replace the token with one you just created.</p>
            <SerangkaiCode class="mt-3" :code="mcpConfig" language="json" filename="mcp.json" />
          </div>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="oauth-connection">
          <p class="agent-section-label">03 / AUTHORIZATION</p><h2 id="oauth-connection" class="agent-section-title">Browser sign-in (OAuth)</h2>
          <p class="mt-1 text-sm text-[var(--selaras-resolved-text-muted)]">
            Hosted MCP clients can connect without a pasted token. Point the client at the MCP URL
            and it discovers this installation's authorization server from the endpoint's
            <code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1 py-0.5 font-mono text-xs">401</code>
            response, opens a browser, and asks you to approve it.
          </p>
          <ul class="mt-3 space-y-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">No URL to configure.</strong>
              Every endpoint is derived from the MCP URL the client used, so a self-hosted
              instance works at whatever address it is served from.
            </li>
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">Scopes stay limited.</strong>
              A browser-approved client can only receive <code>read</code> and <code>write</code>.
              It can never mint or revoke API tokens.
            </li>
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">Revocable.</strong>
              Approved clients appear under Settings → Connected agents, and disconnecting one
              cuts off its access immediately.
            </li>
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">HTTPS required.</strong>
              MCP clients reject plain-HTTP servers except on loopback, so put a deployed
              instance behind TLS.
            </li>
          </ul>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="publishing">
          <p class="agent-section-label">04 / WORKFLOW</p><h2 id="publishing" class="agent-section-title">Publishing safely</h2>
          <ul class="mt-3 space-y-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            <li>
              <strong class="text-[var(--selaras-resolved-text-default)]">Read before you write.</strong>
              Call <code>get_rangka</code>, keep the content, then publish with
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
            <p class="agent-section-label">05 / REST</p><h2 id="rest-examples" class="agent-section-title">REST examples</h2>
          </div>
          <div class="p-5">
            <SerangkaiCode :code="restExample" language="bash" />
            <p class="mt-3 text-sm text-[var(--selaras-resolved-text-muted)]">
              Rangka are private by default. Set <code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1 py-0.5 font-mono text-xs">visibility</code> deliberately — unlisted links also require the signed key.
            </p>
          </div>
        </section>
        <section class="serangkai-panel p-5" aria-labelledby="color-mode">
          <h2 id="color-mode" class="text-sm font-semibold">Color mode</h2>
          <p class="mt-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            HTML rangka follow the viewer's light or dark preference automatically.
            Write standard CSS — the host injects a small bridge.
          </p>
          <SerangkaiCode class="mt-2" :code="colorModeExample" language="css" :show-header="false" />
          <p class="mt-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            To pin one scheme, declare
            <code>&lt;meta name="color-scheme" content="only light"&gt;</code>.
          </p>
        </section>
        <section class="serangkai-panel p-5" aria-labelledby="html-diagrams">
          <h2 id="html-diagrams" class="text-sm font-semibold">HTML diagrams &amp; charts</h2>
          <p class="mt-2 text-sm text-[var(--selaras-resolved-text-muted)]">
            Add a <code>.mermaid</code> block or a JSON chart marker. Serangkai
            injects only the runtime the rangka needs — no CDN, and no
            author JavaScript is evaluated.
          </p>
          <SerangkaiCode class="mt-2" :code="htmlDiagramExample" language="html" :show-header="false" />
        </section>
      </div>

      <aside class="min-w-0 space-y-4">
        <section class="serangkai-panel p-5" aria-labelledby="tools">
          <p class="agent-section-label">REFERENCE</p><h2 id="tools" class="agent-section-title">MCP tools</h2>
          <ul class="mt-3 space-y-1.5">
            <li v-for="tool in toolList" :key="tool.name" class="text-sm">
              <code class="rounded bg-[var(--selaras-resolved-surface-elevated)] px-1.5 py-0.5 font-mono text-xs">{{ tool.name }}</code>
              <span class="ms-1.5 text-[var(--selaras-resolved-text-muted)]">{{ tool.hint }}</span>
            </li>
          </ul>
        </section>

        <section class="serangkai-panel p-5" aria-labelledby="scopes">
          <p class="agent-section-label">PERMISSIONS</p><h2 id="scopes" class="agent-section-title">Scopes</h2>
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
useHead({ title: 'Connect an agent' })

const { loggedIn } = useUserSession()

const origin = computed(() => (import.meta.client ? window.location.origin : ''))
const mcpUrl = computed(() => `${origin.value}/api/mcp`)
const restUrl = computed(() => `${origin.value}/api/rangka`)

const toolList = [
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
.agent-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 1.25rem; padding: .25rem 0 1rem; }
.agent-heading h1 { margin-top: .75rem; font-size: 1.875rem; font-weight: 700; line-height: 1.2; letter-spacing: -.035em; }
.agent-heading > div > p:last-child, .agent-start-intro > p:last-child { margin-top: .65rem; max-width: 38rem; color: var(--selaras-resolved-text-muted); font-size: .9rem; line-height: 1.7; }
.agent-eyebrow, .agent-section-label { display: flex; align-items: center; gap: .5rem; color: var(--selaras-resolved-color-primary-text); font-size: .65rem; font-weight: 700; letter-spacing: .12em; }
.agent-start { display: grid; gap: 1.75rem; padding: clamp(1.25rem, 3vw, 2rem); border-radius: var(--selaras-resolved-radius-lg); background: var(--selaras-resolved-color-primary-subtle); }
.agent-start h2 { margin-top: .7rem; font-size: clamp(1.45rem, 2.6vw, 2rem); font-weight: 700; letter-spacing: -.04em; }
.agent-steps { display: grid; gap: .75rem; }
.agent-steps > div { display: flex; align-items: start; gap: .8rem; padding-top: .75rem; border-top: 1px solid var(--selaras-resolved-border-default); }
.agent-steps > div > span { color: var(--selaras-resolved-color-primary-text); font-size: .7rem; font-weight: 700; padding-top: .15rem; }
.agent-steps strong, .agent-steps small { display: block; }.agent-steps strong { font-size: .85rem; }.agent-steps small { margin-top: .2rem; color: var(--selaras-resolved-text-muted); font-size: .75rem; line-height: 1.5; }
.agent-jump { display: flex; align-items: center; gap: .75rem 1.25rem; flex-wrap: wrap; padding: .4rem 0 1rem; border-bottom: 1px solid var(--selaras-resolved-border-default); font-size: .8rem; }
.agent-jump span { color: var(--selaras-resolved-text-muted); font-size: .62rem; font-weight: 700; letter-spacing: .1em; }.agent-jump a { color: var(--selaras-resolved-text-muted); }.agent-jump a:hover { color: var(--selaras-resolved-color-primary-text); text-decoration: underline; }
.agent-layout section { min-width: 0; }.agent-layout h2[id] { scroll-margin-top: 6rem; }.agent-section-title { margin-top: .4rem; font-size: 1.05rem; font-weight: 700; letter-spacing: -.02em; }.agent-page code { overflow-wrap: anywhere; }
@media (min-width: 768px) { .agent-start { grid-template-columns: minmax(0, .8fr) minmax(0, 1fr); align-items: center; } .agent-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); } .agent-steps > div { flex-direction: column; } }
</style>
