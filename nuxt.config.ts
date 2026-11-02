// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@sewadah/selaras', '@nuxt/content'],
  css: ['~/assets/css/main.css'],
  nitro: {
    experimental: {
      openAPI: true
    }
  },
  content: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark'
      }
    }
  }
})
