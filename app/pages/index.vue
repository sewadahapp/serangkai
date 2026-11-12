<template>
  <div class="home-page">
    <section class="home-hero" aria-labelledby="home-title">
      <div class="home-hero-copy">
        <p class="home-kicker"><span /> A workspace for humans &amp; agents</p>
        <h1 id="home-title">Good work deserves<br><em>a place to live.</em></h1>
        <p class="home-intro">Bring your agents’ output and your own ideas together in one private, organized workspace.</p>
        <div class="home-actions">
          <SButton :to="loggedIn ? '/workspace' : '/auth/login'" size="lg" trailing-icon="lucide:arrow-right">
            {{ loggedIn ? 'Open workspace' : 'Log in to your workspace' }}
          </SButton>
          <SButton to="/agent" size="lg" variant="outline">Connect an agent</SButton>
        </div>
        <div class="home-assurance"><SIcon name="lucide:shield-check" class="size-4" aria-hidden="true" /> Self-hosted <span>·</span> Private by default <span>·</span> Open source</div>
      </div>

      <div class="home-preview-wrap" aria-label="Illustration of a Serangkai workspace">
        <div class="home-preview">
          <div class="preview-header"><div><strong>Workspace</strong><p>Create, upload, and organize your artifacts.</p></div><span>+ New artifact</span></div>
          <div class="preview-body">
            <div class="preview-sidebar">
              <p>WORKSPACE</p>
              <div class="preview-nav active"><SIcon name="lucide:layers" /> All artifacts <span>3</span></div>
              <div class="preview-nav"><SIcon name="lucide:folder" /> Research <span>2</span><SIcon name="lucide:ellipsis" /></div>
              <div class="preview-nav"><SIcon name="lucide:folder" /> Projects <span>1</span><SIcon name="lucide:ellipsis" /></div>
            </div>
            <div class="preview-content">
              <div class="preview-breadcrumb">Workspace <span>/</span> All artifacts</div>
              <div class="preview-list-heading"><div><strong>All artifacts</strong><p>3 artifacts</p></div><SIcon name="lucide:search" /></div>
              <div class="preview-artifact"><span class="preview-artifact-icon"><SIcon name="lucide:file-text" /></span><div><strong>Research notes</strong><p>Markdown · Research</p></div><small>Private</small></div>
              <div class="preview-artifact"><span class="preview-artifact-icon"><SIcon name="lucide:code-xml" /></span><div><strong>Project brief</strong><p>HTML · Projects</p></div><small>Private</small></div>
              <div class="preview-artifact"><span class="preview-artifact-icon"><SIcon name="lucide:file-text" /></span><div><strong>Ideas to explore</strong><p>Markdown · Research</p></div><small>Private</small></div>
            </div>
          </div>
        </div>
        <div class="home-preview-caption"><span>01 / THE WORKSPACE</span><span>Made to be useful, made to be yours.</span></div>
      </div>
    </section>

    <section class="home-strip" aria-label="Supported artifact types">
      <span>ONE HOME FOR YOUR WORK</span>
      <div><span>Markdown</span><span>HTML</span><span>PDFs</span><span>Images</span><span>Static bundles</span></div>
    </section>

    <section class="home-section" aria-labelledby="possibilities-title">
      <div class="home-section-heading">
        <div><p class="home-overline">A LITTLE MORE ROOM TO THINK</p><h2 id="possibilities-title">From first draft<br>to <em>something lasting.</em></h2></div>
        <p>Give useful work a home beyond the chat window. Serangkai brings creation, organization, and sharing into one calm space.</p>
      </div>
      <div class="home-features">
        <article v-for="feature in features" :key="feature.number" class="home-feature">
          <div class="home-feature-top"><span>{{ feature.number }}</span><SIcon :name="feature.icon" aria-hidden="true" /></div>
          <h3>{{ feature.title }}</h3><p>{{ feature.description }}</p>
        </article>
      </div>
    </section>

    <section class="home-agent" aria-labelledby="agent-title">
      <div class="home-agent-copy">
        <p class="home-overline">BUILT FOR WORKING TOGETHER</p>
        <h2 id="agent-title">Your agents can<br><em>make themselves useful.</em></h2>
        <p>Connect over MCP or REST and let agents create and update artifacts directly. You stay in control of what gets shared.</p>
        <NuxtLink to="/agent" class="home-text-link">Explore agent setup <SIcon name="lucide:arrow-up-right" aria-hidden="true" /></NuxtLink>
      </div>
      <div class="home-flow">
        <div class="home-flow-label">A SIMPLE FLOW <span>↗</span></div>
        <div v-for="step in steps" :key="step.number" class="home-flow-row"><span>{{ step.number }}</span><div><strong>{{ step.title }}</strong><p>{{ step.detail }}</p></div><SIcon :name="step.icon" aria-hidden="true" /></div>
      </div>
    </section>

    <section class="home-ending">
      <div><p class="home-overline">YOURS TO KEEP</p><h2>A quieter home for<br><em>your best work.</em></h2><p>Run Serangkai on your own infrastructure, with SQLite and the filesystem by default.</p></div>
      <SButton :to="loggedIn ? '/workspace' : '/auth/login'" size="lg" trailing-icon="lucide:arrow-right">{{ loggedIn ? 'Open workspace' : 'Get started' }}</SButton>
    </section>
  </div>
</template>

<script setup lang="ts">
import { SITE_DESCRIPTION, SITE_TITLE } from '#shared/site'

const { loggedIn } = useUserSession()
const requestUrl = useRequestURL()
const canonical = computed(() => `${requestUrl.origin}/`)

useHead({
  title: SITE_TITLE,
  titleTemplate: null,
  meta: [
    { name: 'robots', content: 'index, follow' },
    { property: 'og:title', content: SITE_TITLE },
    { property: 'og:description', content: SITE_DESCRIPTION },
    { name: 'twitter:title', content: SITE_TITLE },
    { name: 'twitter:description', content: SITE_DESCRIPTION },
  ],
  link: [{ rel: 'canonical', href: canonical.value }],
})

const features = [
  { number: '01', icon: 'lucide:folders', title: 'Gather it all', description: 'Keep documents, interfaces, and files together in nested folders that make sense to you.' },
  { number: '02', icon: 'lucide:history', title: 'Keep the thread', description: 'Every save adds a version, so you can revisit an idea or restore an earlier draft.' },
  { number: '03', icon: 'lucide:lock-keyhole', title: 'Share on your terms', description: 'Your work starts private. Share deliberately with signed, unlisted links when you’re ready.' },
]
const steps = [
  { number: '01', title: 'Connect', detail: 'Give your agent a scoped API token.', icon: 'lucide:plug' },
  { number: '02', title: 'Create', detail: 'Send artifacts through MCP or REST.', icon: 'lucide:sparkles' },
  { number: '03', title: 'Make it yours', detail: 'Review, organize, and share your work.', icon: 'lucide:check' },
]
</script>

<style scoped>
.home-page { padding-top: 1.5rem; }
.home-hero { display: grid; gap: 4rem; align-items: center; padding: 3rem 0 5rem; }
.home-kicker, .home-overline { font-size: .69rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--selaras-resolved-color-primary-text); }
.home-kicker { display: flex; align-items: center; gap: .65rem; }
.home-kicker span { width: .5rem; height: .5rem; border-radius: 50%; background: var(--selaras-resolved-color-primary-indicator); }
.home-hero h1, .home-section h2, .home-agent h2, .home-ending h2 { font-size: clamp(2.8rem, 5.2vw, 5.3rem); line-height: 1.08; letter-spacing: -.065em; font-weight: 600; margin-top: 1.5rem; }
.home-page h1 em, .home-page h2 em { font-family: Georgia, serif; font-weight: 400; }
.home-intro { max-width: 31rem; margin-top: 1.6rem; font-size: 1.1rem; line-height: 1.8; color: var(--selaras-resolved-text-muted); }
.home-actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 2rem; }
.home-assurance { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; margin-top: 2.5rem; color: var(--selaras-resolved-text-muted); font-size: .76rem; }
.home-assurance svg { color: var(--selaras-resolved-color-primary-text); }
.home-preview-wrap { min-width: 0; }
.home-preview { overflow: hidden; border: 1px solid var(--selaras-resolved-border-default); border-radius: 12px; background: var(--selaras-resolved-surface-default); box-shadow: 0 22px 60px rgb(25 35 30 / .12); }
 .preview-header { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: 1.3rem; }
.preview-header strong { font-size: .95rem; }.preview-header p { margin-top: .25rem; font-size: .58rem; color: var(--selaras-resolved-text-muted); }.preview-header > span { padding: .5rem .65rem; border-radius: 5px; white-space: nowrap; background: var(--selaras-resolved-color-primary-fill); color: var(--selaras-resolved-color-primary-on-fill); font-size: .58rem; font-weight: 700; }
.preview-body { display: grid; grid-template-columns: 145px minmax(0, 1fr); gap: 1rem; min-height: 265px; padding: .5rem 1.3rem 1.5rem; }
.preview-sidebar { align-self: start; padding: .7rem .4rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: 7px; font-size: .63rem; }
.preview-sidebar > p { padding: .3rem .5rem .7rem; font-size: .52rem; font-weight: 700; letter-spacing: .1em; color: var(--selaras-resolved-text-muted); }
.preview-nav { display: flex; align-items: center; gap: .4rem; padding: .5rem; color: var(--selaras-resolved-text-muted); }.preview-nav svg { width: .8rem; height: .8rem; flex-shrink: 0; }.preview-nav span { margin-left: auto; }.preview-nav.active { border-radius: 5px; color: var(--selaras-resolved-color-primary-text); background: var(--selaras-resolved-color-primary-subtle); font-weight: 700; }
.preview-content { min-width: 0; }.preview-breadcrumb { margin: .4rem 0 1.4rem; color: var(--selaras-resolved-text-muted); font-size: .6rem; }.preview-breadcrumb span { padding: 0 .35rem; opacity: .5; }
.preview-list-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }.preview-list-heading strong { font-size: .85rem; }.preview-list-heading p { margin-top: .2rem; font-size: .6rem; color: var(--selaras-resolved-text-muted); }.preview-list-heading > svg { width: .9rem; color: var(--selaras-resolved-text-muted); }
.preview-artifact { display: flex; align-items: center; gap: .6rem; padding: .75rem .2rem; border-bottom: 1px solid var(--selaras-resolved-border-default); }.preview-artifact-icon { display: grid; flex-shrink: 0; place-items: center; width: 2rem; height: 2rem; border-radius: 5px; color: var(--selaras-resolved-color-primary-text); background: var(--selaras-resolved-color-primary-subtle); }.preview-artifact-icon svg { width: 1rem; }.preview-artifact div { min-width: 0; }.preview-artifact strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .65rem; }.preview-artifact p { margin-top: .2rem; font-size: .55rem; color: var(--selaras-resolved-text-muted); }.preview-artifact small { margin-left: auto; padding: .2rem .35rem; border-radius: 4px; background: var(--selaras-resolved-surface-elevated); color: var(--selaras-resolved-text-muted); font-size: .5rem; }
.home-preview-caption { display: flex; justify-content: space-between; gap: 1rem; padding-top: .9rem; color: var(--selaras-resolved-text-muted); font-size: .65rem; }.home-preview-caption span:first-child { font-weight: 700; letter-spacing: .1em; }
.home-strip { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.25rem; padding: 1.5rem 0; border-block: 1px solid var(--selaras-resolved-border-default); }.home-strip > span { color: var(--selaras-resolved-text-muted); font-size: .62rem; font-weight: 700; letter-spacing: .12em; }.home-strip div { display: flex; flex-wrap: wrap; gap: .8rem 2rem; font-size: .8rem; font-weight: 600; }
.home-section { padding: 7rem 0; }.home-section-heading { display: grid; gap: 2rem; align-items: end; }.home-section h2, .home-agent h2, .home-ending h2 { margin-top: 1rem; font-size: clamp(2.4rem, 4vw, 4rem); }.home-section-heading > p, .home-agent-copy > p:not(.home-overline), .home-ending > div > p:not(.home-overline) { max-width: 27rem; line-height: 1.8; color: var(--selaras-resolved-text-muted); }
.home-features { display: grid; margin-top: 3.5rem; border-top: 1px solid var(--selaras-resolved-border-default); }.home-feature { padding: 1.5rem 0 2rem; border-bottom: 1px solid var(--selaras-resolved-border-default); }.home-feature-top { display: flex; justify-content: space-between; align-items: center; color: var(--selaras-resolved-color-primary-text); }.home-feature-top span { font-size: .7rem; font-weight: 700; }.home-feature-top svg { width: 1.3rem; height: 1.3rem; }.home-feature h3 { margin-top: 2.5rem; font-size: 1.15rem; font-weight: 700; }.home-feature p { margin-top: .75rem; max-width: 23rem; font-size: .9rem; line-height: 1.75; color: var(--selaras-resolved-text-muted); }
.home-agent { display: grid; gap: 3rem; padding: clamp(2rem, 5vw, 4.5rem); border-radius: 12px; background: var(--selaras-resolved-color-primary-subtle); }.home-agent-copy > p:not(.home-overline) { margin-top: 1.5rem; }.home-text-link { display: inline-flex; gap: .5rem; align-items: center; margin-top: 2rem; color: var(--selaras-resolved-color-primary-text); font-size: .85rem; font-weight: 700; }.home-text-link svg { width: 1rem; }.home-flow { padding: 1.5rem; border: 1px solid var(--selaras-resolved-border-default); border-radius: 8px; background: var(--selaras-resolved-surface-default); }.home-flow-label { display: flex; justify-content: space-between; padding-bottom: 1rem; color: var(--selaras-resolved-text-muted); font-size: .62rem; font-weight: 700; letter-spacing: .12em; }.home-flow-row { display: grid; grid-template-columns: 2rem 1fr auto; gap: .5rem; align-items: start; padding: 1.2rem 0; border-top: 1px solid var(--selaras-resolved-border-default); }.home-flow-row > span { color: var(--selaras-resolved-color-primary-text); font-size: .7rem; }.home-flow-row strong { font-size: .9rem; }.home-flow-row p { margin-top: .25rem; color: var(--selaras-resolved-text-muted); font-size: .75rem; }.home-flow-row svg { width: 1rem; color: var(--selaras-resolved-text-muted); }
.home-ending { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 2rem; padding: 7rem 0 5rem; }.home-ending > div > p:not(.home-overline) { margin-top: 1.3rem; }
@media (min-width: 768px) { .home-section-heading { grid-template-columns: 1fr 1fr; }.home-features { grid-template-columns: repeat(3, 1fr); }.home-feature { padding: 1.5rem 2rem 2rem; border-bottom: 0; border-right: 1px solid var(--selaras-resolved-border-default); }.home-feature:first-child { padding-left: 0; }.home-feature:last-child { border-right: 0; }.home-agent { grid-template-columns: 1fr 1fr; align-items: center; } }
@media (min-width: 1024px) { .home-hero { grid-template-columns: 1fr 1fr; gap: 5rem; padding: 4rem 0 6rem; } }
@media (max-width: 480px) { .preview-body { grid-template-columns: 105px minmax(0, 1fr); gap: .6rem; padding-inline: .7rem; }.preview-header { padding-inline: .7rem; }.preview-nav { gap: .25rem; padding-inline: .3rem; }.preview-nav svg:last-child { display: none; }.preview-artifact small { display: none; }.home-preview-caption span:last-child { display: none; }.home-section, .home-ending { padding-block: 4.5rem; } }
</style>
