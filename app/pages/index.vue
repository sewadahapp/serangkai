<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'A home for the work your agents make',
  description: 'Serangkai is a self-hosted workspace where you and your AI agents publish reports, dashboards, diagrams, charts, and small HTML apps.',
  ogImage: 'https://sewadahapp.github.io/serangkai/og-image.png',
  ogImageAlt: 'Serangkai: a home for the work your agents make.',
  twitterCard: 'summary_large_image',
})

const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const el = root.value
  if (!el) return
  el.classList.add('lb-js')
  const targets = el.querySelectorAll<HTMLElement>('[data-reveal]')
  if (!('IntersectionObserver' in window)) {
    targets.forEach(t => t.classList.add('is-in'))
    return
  }
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in')
        observer?.unobserve(entry.target)
      }
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 })
  targets.forEach(t => observer!.observe(t))
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="lb flex min-h-screen flex-col">
    <DocsHeader />

    <main class="flex-1">
      <LandingHero />
      <LandingAssembly />
      <LandingKinds />
      <LandingPermissions />
      <LandingSelfHost />
      <LandingClosing />
    </main>

    <DocsFooter />
  </div>
</template>

<style>
/* Newsreader and IBM Plex Mono (SIL OFL), latin subset, served with the site. */
@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 300 600;
  font-display: swap;
  src: url('~/assets/fonts/newsreader-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Newsreader';
  font-style: italic;
  font-weight: 300 500;
  font-display: swap;
  src: url('~/assets/fonts/newsreader-italic-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('~/assets/fonts/ibm-plex-mono-400-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'IBM Plex Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('~/assets/fonts/ibm-plex-mono-500-latin.woff2') format('woff2');
}

/* The landing page's shared language. Everything is namespaced under .lb. */
.lb {
  --b-ink: var(--selaras-resolved-text-default);
  --b-muted: var(--selaras-resolved-text-muted);
  --b-line: var(--selaras-resolved-border-default);
  --b-line-soft: var(--selaras-resolved-border-muted);
  --b-paper: var(--selaras-resolved-surface-canvas);
  --b-sheet: var(--selaras-resolved-surface-default);
  --b-raised: var(--selaras-resolved-surface-elevated);
  --b-accent: var(--selaras-resolved-color-primary-text);
  --b-accent-fill: var(--selaras-resolved-color-primary-fill);
  --b-accent-soft: var(--selaras-resolved-color-primary-subtle);
  --b-danger: var(--selaras-resolved-color-danger-text);
  --b-success: var(--selaras-resolved-color-success-text);

  /* The table pieces rest on, and the card stock they are printed on. */
  --b-table: var(--b-raised);
  --b-card: var(--b-paper);
  --b-mark: color-mix(in oklab, var(--b-muted) 55%, transparent);
  --b-shadow-loose: 0 1px 1px rgb(28 35 32 / 0.04), 0 18px 40px -12px rgb(28 35 32 / 0.2);
  --b-shadow-set: 0 1px 1px rgb(28 35 32 / 0.04), 0 2px 6px -2px rgb(28 35 32 / 0.08);

  --b-serif: 'Newsreader', 'Iowan Old Style', 'Charter', 'Georgia', serif;
  --b-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
  --b-ease: cubic-bezier(0.22, 1, 0.36, 1);

  --b-gutter: clamp(1rem, 4vw, 3.5rem);
  --b-max: 82rem;

  background: var(--b-paper);
  color: var(--b-ink);
  overflow-x: clip;
}

.dark .lb {
  --b-table: var(--b-sheet);
  --b-card: var(--b-raised);
  --b-shadow-loose: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 22px 44px -14px rgb(0 0 0 / 0.7);
  --b-shadow-set: 0 1px 0 rgb(255 255 255 / 0.03) inset, 0 2px 8px -2px rgb(0 0 0 / 0.5);
}

.lb-wrap {
  width: 100%;
  max-width: var(--b-max);
  margin-inline: auto;
  padding-inline: var(--b-gutter);
}

.lb-serif { font-family: var(--b-serif); font-optical-sizing: auto; }
.lb-mono { font-family: var(--b-mono); }

.lb-section {
  padding-block: clamp(5rem, 11vw, 9.5rem);
  border-top: 1px solid var(--b-line-soft);
}

.lb-h2 {
  font-family: var(--b-serif);
  font-optical-sizing: auto;
  font-weight: 400;
  font-size: clamp(2.25rem, 1.4rem + 3.4vw, 4.25rem);
  line-height: 1.02;
  letter-spacing: -0.022em;
  text-wrap: balance;
}
.lb-h2 em { font-style: italic; color: var(--b-accent); }

.lb-lede {
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.25rem);
  line-height: 1.6;
  color: var(--b-muted);
  text-wrap: pretty;
  max-width: 38rem;
}

/* Registration brackets: the "rangka" (frame) mark used across the page. */
.lb-marks { position: relative; }
.lb-marks::before {
  --lb-len: 14px;
  --off: -9px;
  content: '';
  position: absolute;
  inset: var(--off);
  pointer-events: none;
  background:
    linear-gradient(var(--b-mark), var(--b-mark)) top left / var(--lb-len) 1px no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) top left / 1px var(--lb-len) no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) top right / var(--lb-len) 1px no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) top right / 1px var(--lb-len) no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) bottom left / var(--lb-len) 1px no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) bottom left / 1px var(--lb-len) no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) bottom right / var(--lb-len) 1px no-repeat,
    linear-gradient(var(--b-mark), var(--b-mark)) bottom right / 1px var(--lb-len) no-repeat;
}
.lb-marks--accent::before { --b-mark: var(--b-accent-fill); }

/* Scroll reveal: pieces settle into place. Hidden only once JS is running. */
.lb-js [data-reveal] {
  opacity: 0;
  transform: translate3d(0, 18px, 0) rotate(var(--reveal-rot, 0deg));
  transition:
    opacity 0.7s var(--b-ease) var(--reveal-delay, 0s),
    transform 0.9s var(--b-ease) var(--reveal-delay, 0s);
}
.lb-js [data-reveal].is-in { opacity: 1; transform: none; }
.lb-js [data-reveal].lb-marks::before {
  --lb-len: 0px;
  transition: --lb-len 0s;
}
.lb-js [data-reveal].lb-marks.is-in::before { animation: lb-marks-draw 0.8s var(--b-ease) calc(var(--reveal-delay, 0s) + 0.15s) both; }

@keyframes lb-marks-draw {
  from { --lb-len: 0px; }
  to { --lb-len: 14px; }
}
@property --lb-len {
  syntax: '<length>';
  inherits: false;
  initial-value: 14px;
}

.lb :focus-visible {
  outline: 2px solid var(--selaras-resolved-color-primary-focus);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .lb-js [data-reveal] { opacity: 1; transform: none; transition: none; }
  .lb-js [data-reveal].lb-marks::before { --lb-len: 14px; animation: none; }
}
</style>
