<script setup lang="ts">
const NuxtLink = resolveComponent('NuxtLink')

const notes = [
  { n: 1, title: 'One volume', text: 'The SQLite database and every uploaded file live under /data. It is the only persistence the container needs.' },
  { n: 2, title: 'One owner', text: 'The username and password create the single owner account. There is no sign-up flow.' },
  { n: 3, title: 'Two stable secrets', text: 'JWT_SECRET seals browser sessions and SHARE_SECRET signs unlisted links. Keep both across redeploys.' },
]

const targets = [
  {
    name: 'Docker',
    tag: 'Default',
    rows: 'SQLite on /data',
    files: 'Local disk on /data',
    note: 'One container on the Bun runtime, with a healthcheck at /api/health.',
    to: '/deploy/docker',
  },
  {
    name: 'Cloudflare Workers',
    rows: 'D1 or Turso',
    files: 'R2 or Backblaze B2',
    note: 'Deploy your own fork in any of four combinations, and update it with Sync fork.',
    to: '/deploy/cloudflare',
  },
  {
    name: 'Vercel',
    rows: 'Turso',
    files: 'S3-compatible storage',
    note: 'Node runtime. Its filesystem is temporary, so data lives in Turso and object storage.',
    to: '/deploy/turso',
  },
]
</script>

<template>
  <section id="self-host" class="lb-section" aria-labelledby="host-title">
    <div class="lb-wrap">
      <header class="head">
        <p class="sec-label lb-mono"><span>04</span> On your own server</p>
        <h2 id="host-title" class="lb-h2">One container. <em>Your</em> disk.</h2>
        <p class="lb-lede">
          The default install is a single Docker container with SQLite and local files.
          No external services to run. Mount a volume, set four variables, and sign in.
        </p>
      </header>

      <div class="install">
        <figure class="term lb-marks" data-reveal>
          <figcaption class="term-head lb-mono"><span>Quick start</span><span class="muted">bash</span></figcaption>
          <pre class="lb-mono"><code><span class="l">docker run -d -p 3000:3000 \</span>
<span class="l hl" data-n="1">  -v serangkai-data:/data \</span>
<span class="l hl" data-n="2">  -e ADMIN_USERNAME=admin \</span>
<span class="l hl" data-n="2">  -e ADMIN_PASSWORD='choose-a-strong-password' \</span>
<span class="l hl" data-n="3">  -e JWT_SECRET=$(openssl rand -base64 32) \</span>
<span class="l hl" data-n="3">  -e SHARE_SECRET=$(openssl rand -base64 32) \</span>
<span class="l">  ghcr.io/sewadahapp/serangkai:latest</span></code></pre>
        </figure>

        <ol class="notes">
          <li v-for="(note, i) in notes" :key="note.n" data-reveal :style="{ '--reveal-delay': `${0.1 + i * 0.08}s` }">
            <span class="num lb-mono" aria-hidden="true">{{ note.n }}</span>
            <div>
              <h3 class="lb-serif">{{ note.title }}</h3>
              <p>{{ note.text }}</p>
            </div>
          </li>
        </ol>
      </div>

      <div class="targets">
        <h3 class="targets-title lb-mono">Where it runs</h3>
        <ul>
          <li v-for="(t, i) in targets" :key="t.name" data-reveal :style="{ '--reveal-delay': `${i * 0.08}s` }">
            <div class="t-top">
              <h4 class="lb-serif">{{ t.name }}</h4>
              <span v-if="t.tag" class="tag lb-mono">{{ t.tag }}</span>
            </div>
            <dl>
              <div><dt>Rows</dt><dd>{{ t.rows }}</dd></div>
              <div><dt>Files</dt><dd>{{ t.files }}</dd></div>
            </dl>
            <p>{{ t.note }}</p>
            <NuxtLink :to="t.to" class="more">Deployment guide<span class="sr-only"> for {{ t.name }}</span></NuxtLink>
          </li>
        </ul>
        <p class="aside">Turso and S3-compatible storage, including Backblaze B2, can be chosen on any runtime.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec-label {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted);
  margin-bottom: 1.25rem;
}
.sec-label span { color: var(--b-accent); }
.sec-label::after { content: ''; flex: 0 0 3rem; height: 1px; background: var(--b-line); }
.head { max-width: 46rem; }
.head .lb-lede { margin-top: 1.5rem; }

.install {
  display: grid;
  gap: 2.5rem;
  margin-top: clamp(3rem, 6vw, 4.5rem);
  align-items: start;
}
@media (min-width: 1024px) { .install { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 4rem; } }

.term {
  margin: 0;
  background: var(--selaras-resolved-surface-inverted);
  color: var(--selaras-resolved-text-inverted);
  border-radius: 12px;
  min-width: 0;
}
.dark .term { background: var(--b-raised); color: var(--b-ink); border: 1px solid var(--b-line); }
.term-head {
  display: flex; justify-content: space-between;
  padding: 0.85rem 1.25rem;
  font-size: 0.75rem;
  border-bottom: 1px solid color-mix(in oklab, currentColor 14%, transparent);
}
.term-head .muted { opacity: 0.6; }
.term pre { margin: 0; padding: 1.25rem 1.25rem 1.5rem 0; overflow-x: auto; font-size: clamp(0.72rem, 0.66rem + 0.25vw, 0.88rem); line-height: 1.85; }
.term code { display: block; min-width: max-content; padding-left: 3rem; }
.l { position: relative; }
.l.hl::before {
  content: attr(data-n);
  position: absolute; left: -1.95rem; top: 50%; transform: translateY(-50%);
  width: 1.15rem; height: 1.15rem; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 0.66rem;
  background: var(--selaras-resolved-color-primary-fill); color: #fff;
}

.notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.notes li { display: grid; grid-template-columns: 2.25rem 1fr; gap: 0.5rem; padding: 1.25rem 0; border-top: 1px solid var(--b-line); }
.notes li:last-child { border-bottom: 1px solid var(--b-line); }
.num {
  width: 1.4rem; height: 1.4rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 0.72rem;
  border: 1px solid var(--b-accent-fill); color: var(--b-accent);
  margin-top: 0.2rem;
}
.notes h3 { font-size: 1.25rem; font-weight: 420; margin: 0; }
.notes p { margin: 0.35rem 0 0; color: var(--b-muted); line-height: 1.55; }

.targets { margin-top: clamp(4rem, 8vw, 6rem); }
.targets-title { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--b-muted); font-weight: 400; margin: 0 0 1rem; }
.targets ul { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--b-ink); }
@media (min-width: 860px) { .targets ul { grid-template-columns: repeat(3, 1fr); } }
.targets li { padding: 1.5rem 0 1.75rem; border-bottom: 1px solid var(--b-line); display: flex; flex-direction: column; }
@media (min-width: 860px) {
  .targets li { padding: 1.75rem 2rem 2rem; border-bottom: 0; }
  .targets li:first-child { padding-left: 0; }
  .targets li + li { border-left: 1px solid var(--b-line); }
}
.t-top { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.targets h4 { font-size: 1.6rem; font-weight: 420; margin: 0; letter-spacing: -0.01em; }
.tag { font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--b-accent); border: 1px solid color-mix(in oklab, var(--b-accent-fill) 45%, transparent); border-radius: 99px; padding: 0.15rem 0.55rem; }
.targets dl { margin: 1.1rem 0 0; display: grid; gap: 0.35rem; }
.targets dl div { display: grid; grid-template-columns: 3.5rem 1fr; }
.targets dt { font-family: var(--b-mono); font-size: 0.75rem; color: var(--b-muted); padding-top: 0.15rem; }
.targets dd { margin: 0; font-weight: 500; }
.targets li p { margin: 1rem 0 0; color: var(--b-muted); line-height: 1.55; }
.more {
  margin-top: auto; padding-top: 1.1rem;
  align-self: flex-start;
  color: var(--b-ink); font-weight: 500;
  text-decoration: underline; text-decoration-color: var(--b-line); text-underline-offset: 0.3em;
  transition: text-decoration-color 0.2s;
}
.more:hover { text-decoration-color: var(--b-accent-fill); }
.aside { margin: 1.5rem 0 0; color: var(--b-muted); font-size: 0.92rem; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
