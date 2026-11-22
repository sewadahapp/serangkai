import { defineColorFromSeed } from '@sewadah/selaras/theme'

// The app's default theme (see nuxt.config.ts on master). Change both together.
const brand = {
  primary: defineColorFromSeed('#2563EB'),
  accent: defineColorFromSeed('#EA580C'),
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
