export default defineNuxtPlugin(async () => {
  const user = useState('user', () => null)
  try {
    const res = await $fetch('/api/auth/me')
    user.value = res.user
  } catch {
    user.value = null
  }
})
