<template>
  <div class="min-h-screen bg-background">
    <SHeader>
      <template #left>
        <NuxtLink to="/" class="text-xl font-bold">Serangkai</NuxtLink>
      </template>
      <template #right>
        <SButton v-if="!user" to="/auth/login" variant="ghost">Login</SButton>
        <SButton v-if="!user" to="/auth/register">Register</SButton>
        <SButton v-if="user" to="/workspace" variant="ghost">Workspace</SButton>
        <SButton v-if="user" @click="logout">Logout</SButton>
      </template>
    </SHeader>
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const user = useState('user')
const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  user.value = null
  navigateTo('/')
}
</script>
