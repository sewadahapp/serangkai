export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  // Signed share links retain their own authorization and public reader.
  if (to.path.startsWith('/share/')) return
  if (to.path === '/auth/login') {
    if (loggedIn.value) return navigateTo('/')
    return
  }
  const privatePage = ['/', '/workspace', '/dashboard', '/settings', '/agent'].includes(to.path)
    || to.path.startsWith('/workspace/') || to.path.startsWith('/rangka/')
  if (privatePage && !loggedIn.value) {
    return navigateTo({ path: '/auth/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } })
  }
})
