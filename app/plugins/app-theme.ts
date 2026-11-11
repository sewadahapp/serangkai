/**
 * Publish the persisted theme on <html> so the CSS presets can select their
 * token overrides. `useAppTheme` reads the cookie during SSR and on the client,
 * keeping the attribute stable across hydration.
 */
export default defineNuxtPlugin(() => {
  const theme = useAppTheme()

  useHead(() => ({
    htmlAttrs: { 'data-serangkai-theme': theme.value },
  }))
})
