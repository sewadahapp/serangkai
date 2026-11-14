<template>
  <div
    class="serangkai-canvas-pattern flex min-h-dvh flex-col bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]"
  >
    <header class="sticky top-0 z-40 shrink-0 border-b border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-canvas)]">
      <div class="serangkai-shell flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Serangkai home">
          <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--selaras-resolved-color-primary-fill)] text-sm font-bold text-[var(--selaras-resolved-color-primary-on-fill)]">S</span>
          <span class="text-base font-semibold tracking-tight">Serangkai</span>
        </NuxtLink>
        <div class="flex shrink-0 items-center gap-2">
          <STooltip v-if="rangka" text="Sharing details">
            <span class="inline-flex">
              <SPopover :positioning="{ align: 'end', sideOffset: 8, collisionPadding: 16 }" :ui="{ content: 'w-72 max-w-[calc(100vw-2rem)] p-4' }">
                <SButton variant="soft" color="neutral" size="sm" :icon="visibilityIcon" aria-label="Sharing details" :ui="{ base: 'rounded-full' }">
                  <span class="hidden sm:inline">{{ visibilityShortLabel }}</span>
                  <SIcon name="lucide:chevron-down" class="hidden size-3 sm:block" aria-hidden="true" />
                </SButton>
                <template #content>
                  <p class="text-sm font-semibold">Sharing details</p>
                  <dl class="mt-4 space-y-4 text-sm">
                    <div class="flex items-start gap-3">
                      <SIcon :name="visibilityIcon" class="mt-0.5 size-4 shrink-0 text-[var(--selaras-resolved-text-muted)]" aria-hidden="true" />
                      <div><dt class="text-xs text-[var(--selaras-resolved-text-muted)]">Access</dt><dd class="mt-1">{{ visibilityLabel }}</dd></div>
                    </div>
                    <div class="flex items-start gap-3">
                      <SIcon name="lucide:clock" class="mt-0.5 size-4 shrink-0 text-[var(--selaras-resolved-text-muted)]" aria-hidden="true" />
                      <div><dt class="text-xs text-[var(--selaras-resolved-text-muted)]">Last updated</dt><dd class="mt-1"><time :datetime="rangka.updatedAt">{{ updatedLabel }}</time></dd></div>
                    </div>
                  </dl>
                </template>
              </SPopover>
            </span>
          </STooltip>
          <SColorModeToggle />
        </div>
      </div>
    </header>

    <!-- A missing or private share keeps the reader chrome but uses the same
         error hero as the rest of the app. -->
    <main v-if="errorInfo" class="serangkai-shell flex flex-1 items-center py-10 md:py-16">
      <SerangkaiErrorHero
        :eyebrow="errorInfo.eyebrow"
        :title="errorInfo.title"
        :description="errorInfo.description"
        :status-code="errorInfo.statusCode"
        :variant="errorInfo.variant"
        primary-label="Back to Serangkai"
        primary-to="/"
        :retry-label="canRetryShared ? 'Try again' : undefined"
        @retry="refresh"
      >
        <template v-if="errorInfo.statusCode === 403" #actions>
          <SButton size="lg" variant="ghost" icon="lucide:log-in" to="/auth/login">Sign in</SButton>
        </template>
      </SerangkaiErrorHero>
    </main>

    <!-- Framed, PDF, and source rangka are the document itself rather than a
         preview inside the page: they use the full width, and the frame or
         viewer fills the first screen. The footer follows in normal flow, so
         only the header is pinned. -->
    <main v-else-if="isFill" class="flex-1">
      <template v-if="rangka">
        <SerangkaiHtmlPreview
          v-if="isFramed && rangka.rawUrl"
          flush
          :src="rangka.rawUrl"
          :title="`${rangka.title} preview`"
          height="calc(100dvh - 4rem)"
        />
        <iframe
          v-else-if="rangka.type === 'pdf' && rangka.rawUrl"
          :src="rangka.rawUrl"
          :title="`${rangka.title} PDF`"
          class="block h-[calc(100dvh-4rem)] w-full border-0 bg-[var(--selaras-resolved-surface-default)]"
        />
        <div v-else-if="isSource" class="p-4 sm:p-6">
          <SerangkaiCode
            :code="rangka.content"
            :language="rangka.type === 'json' ? 'json' : 'javascript'"
            :filename="rangka.filename"
          />
        </div>
      </template>

      <div
        v-else
        class="flex h-[calc(100dvh-4rem)] flex-col gap-4 p-4 sm:p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="sr-only">Loading shared rangka…</span>
        <div aria-hidden="true" class="flex h-full flex-col gap-4">
          <SSkeleton animation="shimmer" class="h-4 w-40" />
          <SSkeleton animation="shimmer" class="flex-1 rounded-lg" />
        </div>
      </div>
    </main>

    <!-- Markdown and images scroll like a document. -->
    <main v-else class="serangkai-shell flex-1 py-10">
      <template v-if="rangka">
        <!-- Markdown keeps its prose measure and contents rail. -->
        <div v-if="rangka.type === 'markdown'" class="share-markdown-layout">
          <article class="share-markdown-article">
            <SAccordion v-if="toc.length" :items="[{ value: 'contents', label: 'On this page' }]" class="share-toc-compact" color="neutral">
              <template #contents><SContentToc :links="toc" /></template>
            </SAccordion>
            <p class="serangkai-eyebrow">{{ visibilityLabel }}</p>
            <h1 v-if="!startsWithHeading" class="serangkai-balance mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{{ rangka.title }}</h1>
            <div :class="startsWithHeading ? 'mt-4' : 'mt-8'">
              <MarkdownDocument :body="rangka.body" />
            </div>
          </article>

          <aside v-if="toc.length" class="share-toc" aria-label="Table of contents">
            <div class="share-toc-sticky">
              <SContentToc :links="toc" />
            </div>
          </aside>
        </div>

        <div v-else-if="rangka.type === 'image'" class="mx-auto max-w-5xl">
          <p class="serangkai-eyebrow">{{ visibilityLabel }}</p>
          <h1 class="serangkai-balance mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{{ rangka.title }}</h1>
          <img
            :src="rangka.rawUrl"
            :alt="rangka.title"
            class="mt-8 max-h-[80vh] w-auto rounded-lg border border-[var(--selaras-resolved-border-default)]"
          >
        </div>
      </template>

      <div v-else class="mx-auto max-w-5xl" role="status" aria-live="polite" aria-busy="true">
        <span class="sr-only">Loading shared rangka…</span>
        <div aria-hidden="true">
          <SSkeleton animation="shimmer" class="h-3 w-24" />
          <SSkeleton animation="shimmer" class="mt-3 h-9 w-3/4" />
          <div class="mt-8 space-y-3">
            <SSkeleton
              v-for="(width, index) in loadingLines"
              :key="index"
              animation="shimmer"
              class="h-4"
              :style="{ width }"
            />
          </div>
        </div>
      </div>
    </main>

    <!-- Every shared type carries the same chrome, so a link always ends the
         same way. Only the header is pinned; the footer closes the page and is
         pushed to the viewport bottom when the content is short. -->
    <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
      <div class="serangkai-shell flex items-center justify-between gap-4 text-sm text-[var(--selaras-resolved-text-muted)]">
        <p class="min-w-0">Shared from Serangkai — a private-by-default rangka workspace.</p>
        <div class="flex shrink-0 items-center gap-1">
          <STooltip text="Serangkai on GitHub">
            <SButton to="https://github.com/sewadahapp/serangkai" target="_blank" rel="noopener noreferrer" variant="ghost" color="neutral" icon="lucide:github" aria-label="Serangkai on GitHub (opens in a new tab)" />
          </STooltip>
          <STooltip text="Selaras documentation">
            <SButton to="https://selarasui.my.id" target="_blank" rel="noopener noreferrer" variant="ghost" color="neutral" square aria-label="Selaras documentation (opens in a new tab)">
              <SerangkaiSelarasMark />
            </SButton>
          </STooltip>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * Reader for a shared rangka.
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

interface SharedRangka {
  slug: string
  title: string
  type: string
  visibility: string
  updatedAt: string
  filename?: string
  body?: Record<string, unknown>
  toc?: Array<{ id: string; text: string; depth: number; children?: any[] }>
  startsWithHeading?: boolean
  content?: string
  rawUrl?: string
}

const slug = String(route.params.slug)
const key = typeof route.query.k === 'string' ? route.query.k : ''
const requestFetch = useRequestFetch()
const loadingLines = ['100%', '92%', '96%', '78%', '100%', '88%', '64%']

const { data: rangka, error: fetchError, refresh } = await useAsyncData(
  `shared-rangka:${slug}`,
  () => requestFetch<SharedRangka>(`/api/share/${slug}`, {
    query: { ...(key ? { k: key } : {}), format: 'json' },
  }),
)

const isFramed = computed(() => rangka.value?.type === 'html' || rangka.value?.type === 'bundle')
const isSource = computed(() => rangka.value?.type === 'json' || rangka.value?.type === 'javascript')

// Types that fill the viewport between the header and footer instead of
// scrolling as a document with a title above the content.
const isFill = computed(() => isFramed.value || isSource.value || rangka.value?.type === 'pdf')

// Most Markdown rangka open with their own `# Title`. Rendering the page
// heading too would show the title twice, so defer to the document when it
// already starts with one.
const startsWithHeading = computed(() => rangka.value?.startsWithHeading === true)

const toc = computed(() => {
  const links = rangka.value?.toc || []
  return links.length >= 2 ? links : []
})

const visibilityLabel = computed(() => (
  rangka.value?.visibility === 'public' ? 'Public rangka'
    : rangka.value?.visibility === 'unlisted' ? 'Shared via signed link'
      : 'Private rangka'
))

const visibilityShortLabel = computed(() => (
  rangka.value?.visibility === 'public' ? 'Public'
    : rangka.value?.visibility === 'unlisted' ? 'Shared link' : 'Private'
))

const visibilityIcon = computed(() => (
  rangka.value?.visibility === 'public' ? 'lucide:globe'
    : rangka.value?.visibility === 'unlisted' ? 'lucide:link' : 'lucide:lock'
))

const updatedLabel = computed(() => (
  rangka.value?.updatedAt
    ? new Date(rangka.value.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : ''
))

interface SharedError {
  statusCode: number
  variant: 'lost' | 'torn'
  eyebrow: string
  title: string
  description: string
}

const errorInfo = computed<SharedError | null>(() => {
  if (!fetchError.value) return null
  const statusCode = Number((fetchError.value as any)?.statusCode) || 500
  if (statusCode === 404) {
    return {
      statusCode,
      variant: 'lost',
      eyebrow: 'Error 404 · Not found',
      title: 'This shared rangka is off the map.',
      description: 'This link is invalid or the rangka is no longer shared. Ask the owner for a fresh link, or open Serangkai.',
    }
  }
  if (statusCode === 403) {
    return {
      statusCode,
      variant: 'torn',
      eyebrow: 'Error 403 · Private rangka',
      title: 'This shared rangka is private.',
      description: 'This rangka is private. Sign in as its owner to view it, or open Serangkai to continue.',
    }
  }
  return {
    statusCode,
    variant: 'torn',
    eyebrow: 'Error 500 · Server error',
    title: 'Something snapped.',
    description: 'The shared rangka could not be loaded, but nothing was lost. Try again, or open Serangkai.',
  }
})

const canRetryShared = computed(() => !!errorInfo.value && errorInfo.value.statusCode >= 500)

// A missing or unauthorized share should answer 404/403, not a soft 200.
if (import.meta.server && fetchError.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, (fetchError.value as any)?.statusCode || 500)
}

useHead(() => ({
  title: rangka.value
    ? (rangka.value.title || 'Shared rangka')
    : errorInfo.value ? errorInfo.value.title : 'Shared rangka',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))
</script>

<style scoped>
/* The header is sticky, so anchored headings need to stop below it instead of
   sliding underneath when a contents link is followed. */
:deep(.selaras-prose :is(h1, h2, h3, h4)) {
  scroll-margin-top: 5.5rem;
}
/* Center the document itself. The independent rail does not offset its axis. */
.share-markdown-layout { position: relative; min-width: 0; }
.share-markdown-article { width: 100%; max-width: 54rem; min-width: 0; margin-inline: auto; }
.share-toc { display: none; }
.share-toc-compact { margin-bottom: 1.5rem; }
.share-markdown-article :deep(.selaras-prose :is(h1, h2, h3, h4):first-child) { margin-block-start: 0; }
@media (min-width: 1536px) {
  .share-toc-compact { display: none; }
  .share-toc { display: block; position: absolute; inset-block: 0; inset-inline-start: calc(50% + 27rem + 1.5rem); width: 13rem; }
  .share-toc-sticky { position: sticky; top: 6rem; max-height: calc(100dvh - 7.5rem); overflow-y: auto; }
}
</style>
