<script setup lang="ts">
const contents = [
  { n: '01', label: 'How it comes together', href: '#how-it-works' },
  { n: '02', label: 'What a rangka can be', href: '#kinds' },
  { n: '03', label: 'Agents, with permission', href: '#permissions' },
  { n: '04', label: 'On your own server', href: '#self-host' },
  { n: '05', label: 'Try the demo', href: '#try' },
]
const NuxtLink = resolveComponent('NuxtLink')
const headline = ['A', 'home', 'for', 'the', 'work', 'your', 'agents', 'make.']
</script>

<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="lb-wrap hero-grid">
      <div class="hero-main">
        <dl class="entry" aria-label="What the name means">
          <div class="entry-row">
            <dt class="lb-serif"><span>se·rang·kai</span></dt>
            <dd><abbr title="Indonesian">Ind.</abbr> <i>n.</i> a set of things joined together</dd>
          </div>
          <div class="entry-row">
            <dt class="lb-serif"><span>rang·ka</span></dt>
            <dd><i>n.</i> a frame; the structure that holds something</dd>
          </div>
        </dl>

        <h1 id="hero-title" class="title">
          <template v-for="(word, i) in headline" :key="i"><span class="word" :style="{ '--i': i }"><span :class="{ accent: word === 'home' }">{{ word }}</span></span>{{ i < headline.length - 1 ? ' ' : '' }}</template>
        </h1>

        <p class="lede lb-lede">
          Serangkai is a self-hosted workspace where you and your AI agents publish
          reports, dashboards, diagrams, charts, and small HTML apps. Agents write over
          MCP with scoped, revocable access. You browse, organize, version, and share
          from the web. Everything starts private.
        </p>

        <div class="actions">
          <SButton as="a" href="https://serangkai.onrender.com" color="primary" variant="solid" size="lg">
            Try the demo
          </SButton>
          <SButton :as="NuxtLink" to="/guide/getting-started" color="neutral" variant="outline" size="lg">
            Read the docs
          </SButton>
          <a class="gh" href="https://github.com/sewadahapp/serangkai" rel="noreferrer">
            <SIcon name="hugeicons:github" aria-hidden="true" />
            <span>View on GitHub</span>
          </a>
        </div>
        <p class="demo-note lb-mono">Demo login: serangkai / serangkai</p>
      </div>

      <nav class="contents" aria-label="On this page">
        <p class="contents-title lb-mono">Contents</p>
        <ol>
          <li v-for="(item, i) in contents" :key="item.n" :style="{ '--i': i }">
            <a :href="item.href">
              <span class="n lb-mono">{{ item.n }}</span>
              <span class="label lb-serif">{{ item.label }}</span>
              <span class="leader" aria-hidden="true" />
            </a>
          </li>
        </ol>
      </nav>
    </div>

    <div class="lb-wrap">
      <ul class="colophon lb-mono" aria-label="At a glance">
        <li>MIT licensed</li>
        <li>One container</li>
        <li>SQLite + local files</li>
        <li>MCP + REST</li>
        <li>OAuth 2.1 + PKCE</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-top: clamp(2.5rem, 6vw, 5rem);
  padding-bottom: clamp(2.5rem, 5vw, 4rem);
}

.hero-grid {
  display: grid;
  gap: 3.5rem;
  align-items: end;
}
@media (min-width: 1024px) {
  .hero-grid { grid-template-columns: minmax(0, 1fr) 19rem; gap: 5rem; }
}

/* Dictionary entry */
.entry {
  display: grid;
  gap: 0.35rem;
  margin-bottom: clamp(2rem, 4vw, 3rem);
  font-size: 0.95rem;
  color: var(--b-muted);
  animation: rise 0.9s var(--b-ease) 0.05s both;
}
.entry-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.9rem; }
.entry dt { font-style: italic; font-size: 1.3rem; color: var(--b-ink); min-width: 7.5rem; }
.entry dd { margin: 0; }
.entry abbr { text-decoration: none; font-variant: small-caps; letter-spacing: 0.04em; }

/* Headline */
.title {
  font-family: var(--b-serif);
  font-optical-sizing: auto;
  font-weight: 380;
  font-size: clamp(3rem, 1.4rem + 5.6vw, 6.6rem);
  line-height: 0.98;
  letter-spacing: -0.035em;
  max-width: 12ch;
  margin: 0;
}
.word { display: inline-block; vertical-align: top; overflow: hidden; padding: 0 0.04em 0.12em; margin: 0 -0.04em -0.12em; }
.word > span { display: inline-block; animation: word-in 1s var(--b-ease) both; animation-delay: calc(0.15s + var(--i) * 0.055s); }
.accent { font-style: italic; color: var(--b-accent); }

.lede { margin-top: clamp(1.75rem, 3vw, 2.5rem); animation: rise 0.9s var(--b-ease) 0.55s both; }

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-top: 2.25rem;
  animation: rise 0.9s var(--b-ease) 0.68s both;
}
.gh {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  font-weight: 500;
  color: var(--b-ink);
  text-decoration: underline;
  text-decoration-color: var(--b-line);
  text-underline-offset: 0.3em;
  transition: text-decoration-color 0.2s;
}
.gh:hover { text-decoration-color: currentColor; }
.demo-note {
  margin-top: 1rem;
  font-size: 0.78rem;
  color: var(--b-muted);
  animation: rise 0.9s var(--b-ease) 0.75s both;
}

/* Contents, like the front matter of a bound set */
.contents { display: none; }
@media (min-width: 1024px) { .contents { display: block; padding-bottom: 0.5rem; } }
.contents-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--b-muted);
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--b-ink);
  animation: rise 0.8s var(--b-ease) 0.4s both;
}
.contents ol { list-style: none; margin: 0; padding: 0; }
.contents li { border-bottom: 1px solid var(--b-line); animation: rise 0.8s var(--b-ease) both; animation-delay: calc(0.5s + var(--i) * 0.07s); }
.contents a {
  display: grid;
  grid-template-columns: 2.25rem 1fr;
  align-items: baseline;
  padding: 0.85rem 0;
  color: var(--b-ink);
  text-decoration: none;
  position: relative;
}
.contents .n { font-size: 0.75rem; color: var(--b-muted); transition: color 0.2s; }
.contents .label { font-size: 1.2rem; line-height: 1.25; }
.contents .leader {
  position: absolute; left: 2.25rem; right: 0; bottom: -1px; height: 1px;
  background: var(--b-accent-fill);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.45s var(--b-ease);
}
.contents a:hover .leader, .contents a:focus-visible .leader { transform: scaleX(1); }
.contents a:hover .n { color: var(--b-accent); }

/* Colophon strip */
.colophon {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0;
  list-style: none;
  margin: clamp(3.5rem, 7vw, 6rem) 0 0;
  padding: 1rem 0 0;
  border-top: 1px solid var(--b-line);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: var(--b-muted);
  animation: rise 0.9s var(--b-ease) 0.9s both;
}
.colophon li:not(:last-child)::after { content: '/'; margin: 0 0.85rem; color: var(--b-line); }

@keyframes word-in {
  from { transform: translateY(105%); }
  to { transform: none; }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .entry, .word > span, .lede, .actions, .demo-note, .contents-title, .contents li, .colophon { animation: none; }
}
</style>
