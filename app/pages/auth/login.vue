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
      <form class="space-y-4" @submit.prevent="login">
        <SFormField label="Username" required>
          <SInput v-model="username" autocomplete="username" autocapitalize="none" spellcheck="false" required class="w-full" />
        </SFormField>
        <SFormField label="Password" required>
          <SInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
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
useHead({ title: 'Log in · Serangkai' })

const { fetch: refreshSession } = useUserSession()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
    await navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
