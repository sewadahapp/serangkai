<template>
  <div class="mx-auto w-full max-w-md">
    <div class="mb-6">
      <p class="serangkai-eyebrow">Get started</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p class="mt-1.5 text-sm text-[var(--selaras-resolved-text-muted)]">
        One account, one private workspace. You can add agent tokens later.
      </p>
    </div>

    <div class="serangkai-panel p-6">
      <form class="space-y-4" @submit.prevent="register">
        <SFormField label="Email" required>
          <SInput v-model="email" type="email" autocomplete="email" required class="w-full" />
        </SFormField>
        <SFormField label="Password" required hint="At least 6 characters. A passphrase works well.">
          <SInput v-model="password" type="password" autocomplete="new-password" required minlength="6" class="w-full" />
        </SFormField>

        <SAlert v-if="error" color="danger" variant="subtle" :title="error" />

        <SButton type="submit" block size="lg" :loading="loading" :disabled="loading">
          {{ loading ? 'Creating workspace...' : 'Create workspace' }}
        </SButton>
      </form>
    </div>

    <p class="mt-5 text-center text-sm text-[var(--selaras-resolved-text-muted)]">
      Already have an account?
      <NuxtLink to="/auth/login" class="font-medium text-[var(--selaras-resolved-color-primary-text)] underline-offset-4 hover:underline">Log in</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Register · Serangkai' })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const user = useState<any>('user')

const register = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    user.value = res.user
    await navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>
