<script setup lang="ts">
definePageMeta({ layout: false })
useSeoMeta({
  title: 'Serangkai · A workspace for you and your agents',
  description: 'Publish reports, dashboards, diagrams, and small apps to a self-hosted workspace. Connect your agents through MCP or REST.',
})

const demo = 'https://serangkai.onrender.com'
const docs = '/guide/getting-started'
const github = 'https://github.com/sewadahapp/serangkai'

const workflow = [
  { icon: 'terminal', title: 'An agent publishes.', description: 'Connect to MCP or use the REST API. Your agent creates or updates a rangka with the permissions you grant.' },
  { icon: 'panels', title: 'The rangka takes shape.', description: 'Open it in your workspace, move it into a folder, edit it, or look back through its version history.' },
  { icon: 'link', title: 'You decide who sees it.', description: 'Keep the work private, create an unlisted link, or make the rangka public when it’s ready.' },
] as const

const deployment = [
  { icon: 'box', name: 'Docker', description: 'One container, SQLite, and local files. Mount a volume at /data.', link: docs + '#run-it-with-docker' },
  { icon: 'cloud', name: 'Cloudflare Workers', description: 'Choose D1 or Turso for the database, and R2 or Backblaze B2 for files.', link: github + '/blob/master/docs/deploy-cloudflare.md' },
  { icon: 'server', name: 'Vercel', description: 'Use Turso and S3-compatible storage for durable data.', link: github + '#deployment-status' },
] as const

const main = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!main.value || !('IntersectionObserver' in window)) return
  observer = new IntersectionObserver((entries, currentObserver) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('a-entered')
      currentObserver.unobserve(entry.target)
    }
  }, { threshold: .18 })

  for (const element of main.value.querySelectorAll('[data-a-enter]')) observer.observe(element)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="landing-a">
    <DocsHeader />

    <main ref="main" class="a-main">
      <section class="a-hero a-shell" aria-labelledby="a-hero-title">
        <div class="a-hero-intro">
          <div>
            <p class="a-overline">A self-hosted publishing workspace</p>
            <h1 id="a-hero-title">Give agent work <em>a place to live.</em></h1>
          </div>
          <div class="a-hero-side">
            <p>Serangkai is a workspace for interactive work. Your agents publish reports, dashboards, diagrams, and apps. You organize, edit, and share the results from your own server.</p>
            <div class="a-actions">
              <SButton as="a" :href="demo" class="a-button a-primary">Try the demo <LandingAIcon name="arrow-up-right" /></SButton>
              <SButton :to="docs" color="neutral" variant="outline" class="a-button a-secondary">Read the docs</SButton>
            </div>
          </div>
        </div>
        <LandingAPublish />
      </section>

      <section class="a-section a-workflow a-shell" aria-labelledby="a-process-title">
        <div class="a-section-intro">
          <div>
            <p class="a-overline">How it works</p>
            <h2 id="a-process-title">From tool call<br>to shared link.</h2>
          </div>
          <p>Each piece of work is a <strong>rangka</strong>, with its own page, folder, version history, and optional share link.</p>
        </div>
        <ol class="a-workflow-steps">
          <li v-for="(item, index) in workflow" :key="item.title">
            <div class="a-workflow-icon" aria-hidden="true">
              <LandingAIcon :name="item.icon" />
              <span>0{{ index + 1 }}</span>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        </ol>
      </section>

      <section class="a-section a-formats" aria-labelledby="a-formats-title">
        <div class="a-shell">
          <div class="a-section-intro">
            <div>
              <p class="a-overline">Rangka formats</p>
              <h2 id="a-formats-title">A page for the work<br class="a-desktop-break"> you actually make.</h2>
            </div>
            <p>Use Markdown for the everyday work, add charts and diagrams when they explain it better, or publish a small app when it needs its own interface.</p>
          </div>
          <div data-a-enter><LandingAExamples /></div>
        </div>
      </section>

      <section class="a-section a-permissions a-shell" aria-labelledby="a-permissions-title">
        <div class="a-permission-copy">
          <p class="a-overline">Agents and permissions</p>
          <h2 id="a-permissions-title">Give agents<br class="a-desktop-break"> a defined scope.</h2>
          <p>Connect an MCP client through OAuth 2.1, or issue a scoped API token. Grant read or write access and revoke it from your workspace settings.</p>
          <ul class="a-privacy">
            <li><LandingAIcon name="lock" /><span><strong>Private by default.</strong> You choose when to share a rangka.</span></li>
            <li><LandingAIcon name="shield" /><span><strong>Sandboxed HTML.</strong> Apps run in isolated iframes.</span></li>
          </ul>
        </div>
        <div data-a-enter><LandingAAccess /></div>
      </section>

      <section class="a-section a-hosting a-shell" aria-labelledby="a-hosting-title">
        <div class="a-section-intro">
          <div>
            <p class="a-overline">Self-hosting</p>
            <h2 id="a-hosting-title">Run it where you work.</h2>
          </div>
          <p>Serangkai is open source under the MIT license. Start with one Docker container or choose a hosted runtime and bring your own storage.</p>
        </div>
        <ul class="a-deploy">
          <li v-for="item in deployment" :key="item.name">
            <NuxtLink :to="item.link" class="a-deploy-link">
              <span class="a-deploy-name"><LandingAIcon :name="item.icon" /> {{ item.name }}</span>
              <span class="a-deploy-detail">{{ item.description }}</span>
              <LandingAIcon :name="item.link.startsWith('/') ? 'arrow-right' : 'arrow-up-right'" class="a-deploy-arrow" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section class="a-close a-shell" aria-labelledby="a-close-title">
        <div class="a-close-inner">
          <div>
            <h2 id="a-close-title">Publish your<br class="a-desktop-break"> first rangka.</h2>
            <p>Open the demo for a look around, or set up a workspace of your own.</p>
            <div class="a-actions">
              <SButton as="a" :href="demo" class="a-button a-primary">Try the demo <LandingAIcon name="arrow-up-right" /></SButton>
              <SButton :to="docs" color="neutral" variant="outline" class="a-button a-secondary">Read the docs</SButton>
              <NuxtLink :to="github" class="a-source-link">GitHub <LandingAIcon name="arrow-up-right" /></NuxtLink>
            </div>
          </div>
          <div class="a-credentials">
            <h3><LandingAIcon name="key" /> Demo login</h3>
            <dl>
              <div><dt>Username</dt><dd><code>serangkai</code></dd></div>
              <div><dt>Password</dt><dd><code>serangkai</code></dd></div>
            </dl>
            <p>The demo is shared and disposable. Use sample data.</p>
          </div>
        </div>
      </section>
    </main>

    <DocsFooter />
  </div>
</template>

<style scoped>
.landing-a {
  --a-sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --a-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  --a-canvas: color-mix(in oklab, var(--selaras-resolved-surface-canvas) 80%, #f5eedc);
  --a-panel: color-mix(in oklab, var(--selaras-resolved-surface-default) 92%, #fff9e9);
  --a-windowbar: color-mix(in oklab, var(--selaras-resolved-surface-default) 78%, #e4e6d9);
  --a-board: color-mix(in oklab, var(--selaras-resolved-surface-canvas) 24%, #e9ece0);
  --a-ink: color-mix(in oklab, var(--selaras-resolved-text-default) 49%, #192921);
  --a-muted: color-mix(in oklab, var(--selaras-resolved-text-muted) 28%, #49594f);
  --a-rule: color-mix(in oklab, var(--selaras-resolved-border-default) 43%, #d6ddd1);
  --a-board-rule: #c6d0c1;
  --a-dot: #afb9a8;
  --a-accent: #235f4e;
  --a-accent-soft: #e4eee4;
  --a-copper: #96522d;
  --a-copper-soft: #efe0ce;
  --a-action: #235848;
  --a-action-hover: #194537;
  --a-on-accent: #fffdf3;
  --a-shadow: #273e2c12;
  --a-terminal: #212b25;
  --a-terminal-top: #29352c;
  --a-terminal-rule: #415247;
  --a-terminal-text: #f1f5ec;
  --a-terminal-muted: #b4c3b7;
  --a-terminal-accent: #addec5;
  --a-terminal-string: #efc69a;
  color-scheme: light;
  background: var(--a-canvas);
  color: var(--a-ink);
  font-family: var(--a-sans);
}
:global(.dark .landing-a) {
  --a-canvas: color-mix(in oklab, var(--selaras-resolved-surface-canvas) 59%, #18231d);
  --a-panel: color-mix(in oklab, var(--selaras-resolved-surface-default) 52%, #242e29);
  --a-windowbar: color-mix(in oklab, var(--selaras-resolved-surface-default) 42%, #2a3630);
  --a-board: #202b24;
  --a-ink: color-mix(in oklab, var(--selaras-resolved-text-default) 65%, #ecf3e8);
  --a-muted: color-mix(in oklab, var(--selaras-resolved-text-muted) 35%, #b4c3b9);
  --a-rule: color-mix(in oklab, var(--selaras-resolved-border-default) 34%, #394a40);
  --a-board-rule: #3d5043;
  --a-dot: #49594b;
  --a-accent: #a7debe;
  --a-accent-soft: #2a4235;
  --a-copper: #e7ae82;
  --a-copper-soft: #442e22;
  --a-action: #a7debe;
  --a-action-hover: #c2ebd2;
  --a-on-accent: #182b20;
  --a-shadow: #060d0736;
  --a-terminal: #171f1a;
  --a-terminal-top: #202a23;
  color-scheme: dark;
}
.landing-a :deep(.selaras-docs-header) { background: var(--a-canvas); }
.landing-a :deep(.selaras-docs-header-inner) { width: min(100%, 1240px); padding-inline: 28px; }
.landing-a :deep(.selaras-docs-header::after) { border-color: var(--a-rule); }
.landing-a :deep(.selaras-docs-footer) { background: var(--a-canvas); }
.a-main { padding-block-end: clamp(55px, 7vw, 105px); }
.a-shell { width: min(calc(100% - 64px), 1184px); margin-inline: auto; }
.a-hero { padding-top: clamp(44px, 6vw, 85px); }
.a-hero-intro {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, .9fr);
  gap: clamp(22px, 5vw, 80px);
  align-items: end;
  margin-bottom: clamp(26px, 3.2vw, 46px);
  animation: a-hero-in .65s both cubic-bezier(.2,.7,.3,1);
}
.a-overline {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--a-accent);
  font: 650 11px/1.35 var(--a-mono);
  letter-spacing: .105em;
  text-transform: uppercase;
}
.a-overline::before { content: ''; display: block; width: 16px; height: 1px; background: currentColor; }
.a-hero h1 {
  margin-top: 17px;
  font-size: clamp(52px, 6.5vw, 98px);
  line-height: .96;
  font-weight: 670;
  letter-spacing: -.075em;
}
.a-hero h1 em {
  display: block;
  color: var(--a-accent);
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 400;
  font-size: 1.02em;
  letter-spacing: -.072em;
}
.a-hero-side { padding-bottom: 4px; }
.a-hero-side p { max-width: 35ch; margin-bottom: 21px; color: var(--a-muted); font-size: clamp(16px, 1.38vw, 20px); line-height: 1.56; }
.a-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 9px 11px; }
.a-actions :deep(.a-button) { min-height: 44px; padding: 9px 14px; gap: 8px; border-radius: 7px; font: 650 14px/1.35 var(--a-sans); transition: background .15s, border-color .15s; }
.a-actions :deep(.a-button svg) { width: 14px; height: 14px; }
.a-actions :deep(.a-primary) { border: 1px solid var(--a-action); background: var(--a-action); color: var(--a-on-accent); }
.a-actions :deep(.a-primary:hover) { border-color: var(--a-action-hover); background: var(--a-action-hover); }
.a-actions :deep(.a-secondary) { border: 1px solid var(--a-board-rule); background: var(--a-panel); color: var(--a-ink); box-shadow: none; }
.a-actions :deep(.a-secondary:hover) { border-color: var(--a-accent); background: var(--a-accent-soft); }
.landing-a :deep(main :is(a, button):focus-visible) { outline: 2px solid var(--a-accent); outline-offset: 3px; }
.a-section { padding-block: clamp(58px, 7.4vw, 110px); }
.a-section-intro {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, .8fr);
  align-items: end;
  gap: clamp(18px, 5vw, 74px);
  margin-bottom: clamp(28px, 4vw, 51px);
}
.a-section h2, .a-close h2 { margin-top: 12px; font-weight: 650; font-size: clamp(40px, 4.7vw, 70px); line-height: .98; letter-spacing: -.067em; }
.a-section-intro > p, .a-permission-copy > p:not(.a-overline), .a-close-inner > div:first-child > p {
  max-width: 38ch;
  color: var(--a-muted);
  font-size: clamp(16px, 1.28vw, 18px);
  line-height: 1.6;
}
.a-section-intro strong { color: var(--a-ink); }
.a-workflow-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; border-block: 1px solid var(--a-rule); }
.a-workflow-steps li { padding: 21px 23px 23px; }
.a-workflow-steps li:first-child { padding-inline-start: 0; }
.a-workflow-steps li + li { border-inline-start: 1px solid var(--a-rule); }
.a-workflow-icon { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--a-accent); font: 11px var(--a-mono); }
.a-workflow-icon svg { width: 20px; height: 20px; }
.a-workflow-steps h3 { margin-bottom: 6px; font-weight: 660; font-size: 20px; line-height: 1.26; letter-spacing: -.025em; }
.a-workflow-steps p { max-width: 33ch; color: var(--a-muted); font-size: 15px; line-height: 1.58; }
.a-formats { background: var(--a-windowbar); border-block: 1px solid var(--a-rule); }
.a-permissions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: clamp(29px, 7vw, 106px); }
.a-permission-copy > p:not(.a-overline) { margin-top: 20px; }
.a-privacy { display: grid; gap: 11px; margin-top: 22px; color: var(--a-muted); font-size: 14px; line-height: 1.5; }
.a-privacy li { display: flex; align-items: start; gap: 8px; }
.a-privacy strong { color: var(--a-ink); }
.a-privacy svg { flex: none; width: 16px; height: 16px; margin-top: 2px; color: var(--a-accent); }
.a-hosting { border-top: 1px solid var(--a-rule); }
.a-deploy { border-top: 1px solid var(--a-rule); list-style: none; }
.a-deploy li { border-bottom: 1px solid var(--a-rule); }
.a-deploy-link {
  display: grid;
  grid-template-columns: minmax(0, .8fr) minmax(0, 1.3fr) auto;
  align-items: center;
  min-height: 67px;
  gap: 13px;
  padding: 12px 8px;
  border-radius: 5px;
}
.a-deploy-link:hover { background: var(--a-accent-soft); }
.a-deploy-name { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 660; }
.a-deploy-name svg { width: 18px; height: 18px; flex: none; color: var(--a-accent); }
.a-deploy-detail { color: var(--a-muted); font-size: 15px; line-height: 1.5; }
.a-deploy-arrow { color: var(--a-accent); }
.a-close-inner {
  --a-ink: #f3f7ef;
  --a-muted: #cad9c9;
  --a-accent: #b7e7c8;
  --a-action: #c3e8cc;
  --a-action-hover: #d8f3da;
  --a-on-accent: #192e22;
  --a-panel: #253d30;
  --a-board-rule: #5b7965;
  --a-accent-soft: #385541;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, .7fr);
  gap: clamp(23px, 7vw, 108px);
  align-items: center;
  background: #223c2f;
  color: var(--a-ink);
  padding: clamp(27px, 5vw, 74px);
  border: 1px solid var(--a-board-rule);
  border-radius: 15px;
}
.a-close h2 { margin-top: 0; }
.a-close-inner > div:first-child > p { margin: 15px 0 21px; }
.a-source-link { display: inline-flex; gap: 4px; align-items: center; min-height: 44px; padding-inline: 4px; color: var(--a-accent); font-size: 14px; font-weight: 650; }
.a-source-link svg { width: 14px; height: 14px; }
.a-source-link:hover { text-decoration: underline; }
.a-credentials { padding: 16px; border: 1px solid var(--a-board-rule); border-radius: 8px; background: #1d3428; }
.a-credentials h3 { display: flex; align-items: center; gap: 8px; font-weight: 660; font-size: 15px; }
.a-credentials h3 svg { color: var(--a-accent); width: 16px; height: 16px; }
.a-credentials dl { margin-top: 12px; }
.a-credentials dl div { display: flex; align-items: center; justify-content: space-between; gap: 11px; padding: 8px 0; border-top: 1px solid #486251; color: var(--a-muted); font-size: 13px; }
.a-credentials code { color: var(--a-accent); font: 13px var(--a-mono); }
.a-credentials p { margin-top: 8px; color: var(--a-muted); font-size: 12px; line-height: 1.5; }
.a-entered { animation: a-reveal .48s both cubic-bezier(.2,.7,.3,1); }
@keyframes a-hero-in { from { opacity: 0; transform: translateY(13px); } to { opacity: 1; transform: none; } }
@keyframes a-reveal { from { opacity: .62; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@media (max-width: 990px) {
  .a-hero-intro { gap: 27px; grid-template-columns: minmax(0, 1.25fr) minmax(0, .85fr); }
  .a-hero h1 { font-size: clamp(46px, 6.65vw, 73px); }
}
@media (max-width: 740px) {
  .landing-a :deep(.selaras-docs-header-inner) { padding-inline: 15px; }
  .a-shell { width: calc(100% - 36px); }
  .a-hero { padding-top: 43px; }
  .a-hero-intro, .a-section-intro, .a-permissions, .a-close-inner { grid-template-columns: minmax(0, 1fr); }
  .a-hero-intro { gap: 20px; }
  .a-hero h1 { font-size: clamp(45px, 10.7vw, 73px); }
  .a-hero-side p { margin-bottom: 16px; }
  .a-desktop-break { display: none; }
  .a-workflow-steps { grid-template-columns: minmax(0, 1fr); }
  .a-workflow-steps li { padding: 17px 0; }
  .a-workflow-steps li + li { border-inline-start: 0; border-top: 1px solid var(--a-rule); }
  .a-workflow-icon { margin-bottom: 7px; }
  .a-workflow-steps p { max-width: 40ch; }
  .a-deploy-link { grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px; padding-inline: 5px; }
  .a-deploy-detail { grid-column: 1; padding-left: 28px; font-size: 14px; }
  .a-deploy-arrow { grid-column: 2; grid-row: 1 / span 2; }
  .a-close-inner { padding: 22px; }
  .a-close .a-actions :deep(.a-button) { padding-inline: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .a-hero-intro, .a-entered { animation: none; }
  .a-actions :deep(.a-button) { transition: none; }
}
</style>
