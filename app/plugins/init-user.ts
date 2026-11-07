export default defineNuxtPlugin(async () => {
  const user = useState<any>('user', () => null)
  const route = useRoute()

  // The public reader has no account chrome, so asking for a session there only
  // produces a 401 console entry for anonymous visitors. Workspace pages still
  // resolve the session during SSR, so the header never renders logged-out
  // chrome for a signed-in user and then swaps it after hydration.
  if (route.path.startsWith('/share/')) return

  // `useRequestFetch` forwards the request cookies.
  const requestFetch = useRequestFetch()
  try {
    const res = await requestFetch('/api/auth/me')
    user.value = res.user
  } catch {
    user.value = null
  }
})
