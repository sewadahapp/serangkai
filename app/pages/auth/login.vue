<template>
  <div class="max-w-md mx-auto">
    <SCard>
      <SCardHeader>
        <SCardTitle>Login</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <form @submit.prevent="login" class="space-y-4">
          <div>
            <SLabel for="email">Email</SLabel>
            <SInput id="email" v-model="email" type="email" required />
          </div>
          <div>
            <SLabel for="password">Password</SLabel>
            <SInput id="password" v-model="password" type="password" required />
          </div>
          <SButton type="submit" class="w-full" :disabled="loading">Login</SButton>
          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
        </form>
        <p class="mt-4 text-center text-sm">
          Don't have an account? <NuxtLink to="/auth/register" class="text-primary">Register</NuxtLink>
        </p>
      </SCardContent>
    </SCard>
  </div>
</template>

<script setup lang="ts">
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const user = useState('user')

const login = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    user.value = res.user
    navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
