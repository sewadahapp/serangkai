<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const route = useRoute()
const { loggedIn } = useUserSession()

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
  title: title.value,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))
</script>

<template>
  <SApp>
    <div class="serangkai-canvas-pattern flex min-h-dvh flex-col bg-[var(--selaras-resolved-surface-canvas)] text-[var(--selaras-resolved-text-default)]">
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
        <SerangkaiErrorHero
          :eyebrow="eyebrow"
          :title="title"
          :description="description"
          :detail="detail"
          :status-code="statusCode"
          :variant="isNotFound ? 'lost' : 'torn'"
          :primary-label="primaryLabel"
          :primary-icon="primaryIcon"
          :retry-label="canRetry ? 'Try again' : undefined"
          @primary="goBackToApp"
          @retry="retry"
        >
          <template v-if="isNotFound && !loggedIn" #footnote>
            · New here? <NuxtLink to="/auth/login" class="underline underline-offset-4 hover:text-[var(--selaras-resolved-text-default)]">Sign in</NuxtLink>
          </template>
        </SerangkaiErrorHero>
      </main>

      <footer class="border-t border-[var(--selaras-resolved-border-muted)] py-6">
        <div class="serangkai-shell flex flex-col gap-2 text-sm text-[var(--selaras-resolved-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Serangkai — rangka and knowledge workspace.</p>
          <NuxtLink to="/" class="underline-offset-4 hover:underline">Back to home</NuxtLink>
        </div>
      </footer>
    </div>
  </SApp>
</template>
