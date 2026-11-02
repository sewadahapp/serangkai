<template>
  <div class="max-w-md mx-auto">
    <SCard>
      <SCardHeader>
        <SCardTitle>Register</SCardTitle>
      </SCardHeader>
      <SCardContent>
        <form @submit.prevent="register" class="space-y-4">
          <div>
            <SLabel for="email">Email</SLabel>
            <SInput id="email" v-model="email" type="email" required />
          </div>
          <div>
            <SLabel for="password">Password</SLabel>
            <SInput id="password" v-model="password" type="password" required minlength="6" />
          </div>
          <SButton type="submit" class="w-full" :disabled="loading">Register</SButton>
          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
        </form>
        <p class="mt-4 text-center text-sm">
          Already have an account? <NuxtLink to="/auth/login" class="text-primary">Login</NuxtLink>
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

const register = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    user.value = res.user
    navigateTo('/workspace')
  } catch (e: any) {
    error.value = e.data?.message || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>
