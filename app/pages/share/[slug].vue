<template>
  <div
    class="bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]"
  >
    <header class="sticky top-0 z-40 shrink-0 border-b border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-canvas)]">
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

    <!-- Framed, PDF, and source artifacts are the document itself rather than a
         preview inside the page: they use the full width, and the frame or
         viewer fills the first screen. The footer follows in normal flow, so
         only the header is pinned. -->
    <main v-if="isFill">
      <p v-if="error" role="alert" class="serangkai-shell p-6">
        <span class="serangkai-panel block p-5 text-sm text-[var(--selaras-resolved-color-danger-text)]">{{ error }}</span>
      </p>

      <template v-else-if="artifact">
        <SerangkaiHtmlPreview
          v-if="isFramed && artifact.rawUrl"
          flush
          :src="artifact.rawUrl"
          :title="`${artifact.title} preview`"
          height="calc(100dvh - 4rem)"
        />
        <iframe
          v-else-if="artifact.type === 'pdf' && artifact.rawUrl"
          :src="artifact.rawUrl"
          :title="`${artifact.title} PDF`"
          class="block h-[calc(100dvh-4rem)] w-full border-0 bg-[var(--selaras-resolved-surface-default)]"
        />
        <div v-else-if="isSource" class="p-4 sm:p-6">
          <SerangkaiCode
            :code="artifact.content"
            :language="artifact.type === 'json' ? 'json' : 'javascript'"
            :filename="artifact.filename"
          />
        </div>
      </template>

      <p v-else class="serangkai-shell p-6 text-sm text-[var(--selaras-resolved-text-muted)]">Loading shared artifact…</p>
    </main>

    <!-- Markdown and images scroll like a document. -->
    <main v-else class="serangkai-shell py-10">
      <p v-if="error" role="alert" class="serangkai-panel mx-auto max-w-[46rem] p-5 text-sm text-[var(--selaras-resolved-color-danger-text)]">
        {{ error }}
      </p>

      <template v-else-if="artifact">
        <!-- Markdown keeps its prose measure and contents rail. -->
        <div v-if="artifact.type === 'markdown'" class="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,46rem)_13rem]">
          <article>
            <p class="serangkai-eyebrow">{{ visibilityLabel }}</p>
            <h1 v-if="!startsWithHeading" class="serangkai-balance mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{{ artifact.title }}</h1>
            <div :class="startsWithHeading ? 'mt-4' : 'mt-8'">
              <MarkdownDocument :html="artifact.renderedContent" />
            </div>
          </article>

          <aside v-if="toc.length" class="hidden lg:block" aria-label="Table of contents">
            <div class="sticky top-24">
              <SContentToc :links="toc" />
            </div>
          </aside>
        </div>

        <div v-else-if="artifact.type === 'image'" class="mx-auto max-w-5xl">
          <p class="serangkai-eyebrow">{{ visibilityLabel }}</p>
          <h1 class="serangkai-balance mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{{ artifact.title }}</h1>
          <img
            :src="artifact.rawUrl"
            :alt="artifact.title"
            class="mt-8 max-h-[80vh] w-auto rounded-lg border border-[var(--selaras-resolved-border-default)]"
          >
        </div>
      </template>

      <p v-else class="text-sm text-[var(--selaras-resolved-text-muted)]">Loading shared artifact…</p>
    </main>

    <!-- Every shared type carries the same chrome, so a link always ends the
         same way. Only the header is pinned; the footer follows the content. -->
    <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
      <div class="serangkai-shell flex flex-col gap-2 text-sm text-[var(--selaras-resolved-text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Shared from Serangkai — a private-by-default artifact workspace.</p>
        <NuxtLink to="/" class="underline-offset-4 hover:underline">Open Serangkai</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { extractToc } from '~/utils/markdown-toc'

/**
 * Reader for a shared artifact.
 *
 * Every type gets the same sticky header, color-mode toggle, and footer.
 * Markdown renders as prose with a contents rail, images sit in a document
 * page, and HTML, bundles, PDFs, and source files use the full area between
 * the header and footer. Framed types stay sandboxed, so they still cannot
 * reach the app origin, forms, popups, or the network. Delivery stays at
 * `/api/share/:slug` (which redirects browser navigations here) so a typed
 * link and the reopened link in a frame end up in the same place.
 */
const route = useRoute()

// Shared documents are read in isolation: no workspace navigation, which would
// otherwise appear above and below the page's own header and footer.
definePageMeta({ layout: false })

interface SharedArtifact {
  slug: string
  title: string
  type: string
  visibility: string
  updatedAt: string
  filename?: string
  renderedContent?: string
  content?: string
  rawUrl?: string
}

const slug = String(route.params.slug)
const key = typeof route.query.k === 'string' ? route.query.k : ''
const requestFetch = useRequestFetch()

const { data: artifact, error: fetchError } = await useAsyncData(
  `shared-artifact:${slug}`,
  () => requestFetch<SharedArtifact>(`/api/share/${slug}`, {
    query: { ...(key ? { k: key } : {}), format: 'json' },
  }),
)

const isFramed = computed(() => artifact.value?.type === 'html' || artifact.value?.type === 'bundle')
const isSource = computed(() => artifact.value?.type === 'json' || artifact.value?.type === 'javascript')

// Types that fill the viewport between the header and footer instead of
// scrolling as a document with a title above the content.
const isFill = computed(() => isFramed.value || isSource.value || artifact.value?.type === 'pdf')

// Most Markdown artifacts open with their own `# Title`. Rendering the page
// heading too would show the title twice, so defer to the document when it
// already starts with one.
const startsWithHeading = computed(() => /^\s*<h1[\s>]/i.test(artifact.value?.renderedContent || ''))

const toc = computed(() => {
  const links = extractToc(artifact.value?.renderedContent || '')
  return links.length >= 2 ? links : []
})

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

<style scoped>
/* The header is sticky, so anchored headings need to stop below it instead of
   sliding underneath when a contents link is followed. */
:deep(.serangkai-prose :is(h1, h2, h3, h4)) {
  scroll-margin-top: 5.5rem;
}
</style>
