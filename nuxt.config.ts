import { defineColorFromSeed } from '@sewadah/selaras/theme'

// The app's default theme, "porcelain": jade lacquer and a scarlet signal on
// ivory. Mirrors nuxt.config.ts on master; change both together.
const surfaces = { light: '#FDFBF6', dark: '#151A18' }
const brand = {
  primary: defineColorFromSeed('#0B7A5E', { surfaces }),
  accent: defineColorFromSeed('#E0281E', { surfaces }),
}

export default defineNuxtConfig({
  extends: ['@sewadah/selaras-docs'],
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/brand.css'],
  selaras: { theme: { colors: brand } },
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
