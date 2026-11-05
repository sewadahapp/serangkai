<template>
  <div class="mx-auto w-full max-w-md">
    <div class="mb-6">
      <p class="serangkai-eyebrow">Welcome back</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Log in to Serangkai</h1>
      <p class="mt-1.5 text-sm text-[var(--selaras-resolved-text-muted)]">
        Your artifacts stay private to this account.
      </p>
    </div>

    <div class="serangkai-panel p-6">
      <form class="space-y-4" @submit.prevent="login">
        <SFormField label="Email" required>
          <SInput v-model="email" type="email" autocomplete="email" required class="w-full" />
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
      Don't have an account?
      <NuxtLink to="/auth/register" class="font-medium text-[var(--selaras-resolved-color-primary-text)] underline-offset-4 hover:underline">Register</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Log in · Serangkai' })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const user = useState<any>('user')

const login = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    user.value = res.user
    await navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
