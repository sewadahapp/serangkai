<template>
  <div class="mx-auto w-full max-w-md">
    <div class="mb-6">
      <p class="serangkai-eyebrow">Owner sign-in</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Log in to Serangkai</h1>
      <p class="mt-1.5 text-sm text-[var(--selaras-resolved-text-muted)]">
        This workspace has a single owner account configured on the server.
      </p>
    </div>

    <div class="serangkai-panel p-6">
      <!--
        The action/method pair is the no-hydration fallback. Before Vue attaches
        the submit handler, a click would otherwise do a native GET of this page
        and wipe the typed credentials. A native POST lets the server sign in
        and redirect even when the client JS is still loading (or unavailable).
      -->
      <form class="space-y-4" method="post" action="/api/auth/login" @submit.prevent="login">
        <!-- Carries the OAuth consent round-trip through the no-hydration path. -->
        <input type="hidden" name="redirect" :value="returnTo">
        <SFormField label="Username" required>
          <SInput v-model="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required class="w-full" />
        </SFormField>
        <SFormField label="Password" required>
          <SInput v-model="password" name="password" type="password" autocomplete="current-password" required class="w-full" />
        </SFormField>

        <SAlert v-if="error" color="danger" variant="subtle" :title="error" />

        <SButton type="submit" block size="lg" :loading="loading" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Log in' }}
        </SButton>
      </form>
    </div>

    <p class="mt-5 text-center text-sm text-[var(--selaras-resolved-text-muted)]">
      Credentials are managed with <code class="font-mono text-xs">ADMIN_USERNAME</code> and
      <code class="font-mono text-xs">ADMIN_PASSWORD</code> on the server.
    </p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Log in' })

const { fetch: refreshSession } = useUserSession()
const route = useRoute()
const username = ref('')
const password = ref('')
// Native form posts (before hydration) redirect here with a generic error.
const error = ref(route.query.error ? 'Invalid credentials' : '')
const loading = ref(false)

/**
 * Where to go after logging in. Only same-origin, absolute paths are accepted:
 * an open redirect here would let a crafted link bounce a freshly signed-in
 * owner to another site, which matters most for the OAuth consent round-trip.
 */
const returnTo = computed(() => {
  const value = route.query.redirect
  if (typeof value !== 'string') return '/workspace'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/workspace'
  return value
})

const login = async () => {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value.trim(), password: password.value },
    })
    // Update the shared session state before navigating so the header and
    // layout render the signed-in view immediately.
    await refreshSession()
    // `/oauth/authorize` is a server route, not a Nuxt page, so this must be a
    // full navigation rather than a client-side route change.
    await navigateTo(returnTo.value, { external: true })
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
