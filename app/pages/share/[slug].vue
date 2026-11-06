<template>
  <div class="min-h-dvh bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]">
    <header class="border-b border-[var(--selaras-resolved-border-default)]">
      <div class="serangkai-shell flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Serangkai home">
          <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--selaras-resolved-color-primary-fill)] text-sm font-bold text-[var(--selaras-resolved-color-primary-on-fill)]">S</span>
          <span class="text-base font-semibold tracking-tight">Serangkai</span>
        </NuxtLink>
        <div class="flex items-center gap-3">
          <span v-if="artifact" class="hidden text-xs text-[var(--selaras-resolved-text-muted)] sm:inline">
            {{ visibilityLabel }} · updated {{ updatedLabel }}
          </span>
          <SColorModeToggle />
        </div>
      </div>
    </header>

    <main class="serangkai-shell py-10">
      <p v-if="error" role="alert" class="serangkai-panel mx-auto max-w-[46rem] p-5 text-sm text-[var(--selaras-resolved-color-danger-text)]">
        {{ error }}
      </p>

      <article v-else-if="artifact" class="mx-auto max-w-[46rem]">
        <p class="serangkai-eyebrow">{{ visibilityLabel }}</p>
        <h1 v-if="!startsWithHeading" class="serangkai-balance mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{{ artifact.title }}</h1>
        <div :class="startsWithHeading ? 'mt-4' : 'mt-8'">
          <MarkdownDocument :html="artifact.renderedContent" />
        </div>
      </article>

      <p v-else class="text-sm text-[var(--selaras-resolved-text-muted)]">Loading shared artifact…</p>
    </main>

    <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
      <div class="serangkai-shell flex flex-col gap-2 text-sm text-[var(--selaras-resolved-text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Shared from Serangkai — a private-by-default artifact workspace.</p>
        <NuxtLink to="/" class="underline-offset-4 hover:underline">Open Serangkai</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Read-only reader for a shared Markdown artifact.
 *
 * Delivery intentionally happens here rather than in a hand-built HTML string:
 * shared documents get the same prose styles, Shiki highlighting, Mermaid
 * renderer, and charts as the workspace. `/api/share/:slug` applies the
 * visibility rules and redirects here; this page reads through that same
 * endpoint with `?format=json`, forwarded during SSR so private owners and
 * signed links behave identically.
 */
const route = useRoute()

// Shared documents are read in isolation: no workspace navigation, which would
// otherwise appear above and below the page's own header and footer.
definePageMeta({ layout: false })

const slug = String(route.params.slug)
const key = typeof route.query.k === 'string' ? route.query.k : ''
const requestFetch = useRequestFetch()

const { data: artifact, error: fetchError } = await useAsyncData(
  `shared-artifact:${slug}`,
  () => requestFetch(`/api/share/${slug}`, {
    query: { ...(key ? { k: key } : {}), format: 'json' },
  }),
)

// Most Markdown artifacts open with their own `# Title`. Rendering the page
// heading too would show the title twice, so defer to the document when it
// already starts with one.
const startsWithHeading = computed(() => /^\s*<h1[\s>]/i.test(artifact.value?.renderedContent || ''))

const visibilityLabel = computed(() => (
  artifact.value?.visibility === 'public' ? 'Public artifact'
    : artifact.value?.visibility === 'unlisted' ? 'Shared via signed link'
      : 'Private artifact'
))

const updatedLabel = computed(() => (
  artifact.value?.updatedAt
    ? new Date(artifact.value.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : ''
))

const error = computed(() => {
  const statusCode = (fetchError.value as any)?.statusCode
  if (!fetchError.value) return ''
  if (statusCode === 404) return 'This link is invalid or the artifact is no longer shared.'
  if (statusCode === 403) return 'This artifact is private. Sign in as its owner to view it.'
  return 'Unable to load this shared artifact.'
})

// A missing or unauthorized share should answer 404/403, not a soft 200.
if (import.meta.server && fetchError.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, (fetchError.value as any)?.statusCode || 500)
}

useHead(() => ({
  title: artifact.value ? `${artifact.value.title} · Serangkai` : 'Shared artifact · Serangkai',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))
</script>
