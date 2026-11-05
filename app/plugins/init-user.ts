export default defineNuxtPlugin(async () => {
  const user = useState<any>('user', () => null)

  // Resolve the session during SSR too, so the header never renders
  // logged-out chrome on a page the user is already signed in to (and then
  // swaps it after hydration). `useRequestFetch` forwards the request cookies.
  const requestFetch = useRequestFetch()
  try {
    const res = await requestFetch('/api/auth/me')
    user.value = res.user
  } catch {
    user.value = null
  }
})
