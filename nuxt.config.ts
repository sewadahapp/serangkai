export default defineNuxtConfig({
  extends: ['@sewadah/selaras-docs'],
  modules: ['@nuxt/eslint'],
  compatibilityDate: '2026-10-23',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
    },
  },
})
