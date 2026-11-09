<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const route = useRoute()
const { loggedIn } = useUserSession()
const heading = ref<HTMLHeadingElement>()

const statusCode = computed(() => Number(props.error?.statusCode) || 500)
const isNotFound = computed(() => statusCode.value === 404)
const isUnauthorized = computed(() => statusCode.value === 401)
const isServerError = computed(() => statusCode.value >= 500)

const eyebrow = computed(() => (
  isNotFound.value ? 'Error 404 · Not found'
    : statusCode.value === 403 ? 'Error 403 · Forbidden'
      : isUnauthorized.value ? 'Error 401 · Sign in required'
        : isServerError.value ? 'Error 500 · Server error'
          : `Error ${statusCode.value}`
))

const title = computed(() => (
  isNotFound.value ? 'This page is off the map.'
    : statusCode.value === 403 ? 'This page is private.'
      : isUnauthorized.value ? 'Your session has gone quiet.'
        : isServerError.value ? 'Something snapped.'
          : 'Something went wrong.'
))

const description = computed(() => (
  isNotFound.value
    ? 'The link may be broken, or the page may have been moved or deleted. Your workspace is still right where you left it.'
    : statusCode.value === 403
      ? 'You do not have access to this page. If you are the owner, sign in again to continue.'
      : isUnauthorized.value
        ? 'Sign in again to continue where you left off. Nothing in your workspace was changed.'
        : isServerError.value
          ? 'The request could not be completed, but nothing was lost. Try again, or head back to the workspace.'
          : 'The request could not be completed. Return to the workspace and try again.'
))

const canRetry = computed(() => isServerError.value)
const primaryLabel = computed(() => (
  isUnauthorized.value ? 'Sign in'
    : loggedIn.value ? 'Back to workspace'
      : 'Back to home'
))
const primaryIcon = computed(() => (isUnauthorized.value ? 'lucide:log-in' : 'lucide:arrow-left'))

const backTarget = computed(() => (loggedIn.value ? '/workspace' : '/'))
const retryTarget = computed(() => {
  const url = (props.error as { url?: unknown })?.url
  if (typeof url === 'string' && url.startsWith('/')) return url
  if (typeof url === 'string') {
    try {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}`
    } catch {
      // Fall through to the current route.
    }
  }
  return route.fullPath || '/'
})

const isDevelopment = import.meta.dev
const detail = computed(() => {
  if (!isDevelopment || isNotFound.value) return ''
  return String((props.error as { stack?: string })?.stack || props.error?.message || '')
})

const goBackToApp = () => clearError({
  redirect: isUnauthorized.value ? '/auth/login' : backTarget.value,
})

const retry = () => clearError({ redirect: retryTarget.value })

useHead(() => ({
  title: `${title.value} · Serangkai`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))

onMounted(() => heading.value?.focus())
</script>

<template>
  <SApp>
    <div class="flex min-h-dvh flex-col bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]">
      <header class="border-b border-[var(--selaras-resolved-border-default)]">
        <div class="serangkai-shell flex h-16 items-center justify-between gap-4">
          <NuxtLink to="/" class="flex items-center gap-2 rounded-md focus-visible:outline-offset-4" aria-label="Serangkai home">
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--selaras-resolved-color-primary-fill)] text-sm font-bold text-[var(--selaras-resolved-color-primary-on-fill)]">S</span>
            <span class="truncate text-base font-semibold tracking-tight">Serangkai</span>
          </NuxtLink>
          <SColorModeToggle />
        </div>
      </header>

      <main class="serangkai-shell flex flex-1 items-center py-10 md:py-16">
        <div class="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <section>
            <p class="serangkai-eyebrow">{{ eyebrow }}</p>
            <h1
              ref="heading"
              tabindex="-1"
              class="serangkai-balance mt-3 text-4xl font-bold leading-[1.08] tracking-tight outline-none sm:text-5xl"
            >
              {{ title }}
            </h1>
            <p class="serangkai-pretty mt-4 max-w-xl text-lg leading-relaxed text-[var(--selaras-resolved-text-muted)]">
              {{ description }}
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-3">
              <SButton size="lg" :icon="primaryIcon" @click="goBackToApp">{{ primaryLabel }}</SButton>
              <SButton v-if="canRetry" size="lg" variant="outline" icon="lucide:refresh-cw" @click="retry">Try again</SButton>
            </div>

            <p class="mt-6 text-sm text-[var(--selaras-resolved-text-muted)]">
              Error code <span class="serangkai-tabular font-mono text-[var(--selaras-resolved-text-default)]">{{ statusCode }}</span>
              <template v-if="isNotFound && !loggedIn">
                · New here? <NuxtLink to="/auth/login" class="underline underline-offset-4 hover:text-[var(--selaras-resolved-text-default)]">Sign in</NuxtLink>
              </template>
            </p>

            <details v-if="detail" class="mt-6 max-w-xl rounded-md border border-[var(--selaras-resolved-border-muted)] p-3 text-sm">
              <summary class="cursor-pointer font-medium">Error details (development only)</summary>
              <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[var(--selaras-resolved-text-muted)]">{{ detail }}</pre>
            </details>
          </section>

          <div class="mx-auto w-full max-w-md lg:max-w-none">
            <SerangkaiErrorDoodle :variant="isNotFound ? 'lost' : 'torn'" />
          </div>
        </div>
      </main>

      <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
        <div class="serangkai-shell flex flex-col gap-2 text-sm text-[var(--selaras-resolved-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Serangkai — artifact and knowledge workspace.</p>
          <NuxtLink to="/" class="underline-offset-4 hover:underline">Back to home</NuxtLink>
        </div>
      </footer>
    </div>
  </SApp>
</template>
