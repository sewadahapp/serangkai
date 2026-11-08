// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineColorFromSeed } from '@sewadah/selaras/theme'
import { selarasIconNames } from './shared/selaras-icons'

// Design system generated with ui-ux-pro-max:
//   Minimalism & Swiss Style · variance 3 / motion 3 / density 5
//   Trust blue primary (#2563EB) with a warm orange call to action (#EA580C)
//   Plus Jakarta Sans for UI copy
const theme = {
  primary: defineColorFromSeed('#2563EB'),
  accent: defineColorFromSeed('#EA580C'),
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@sewadah/selaras', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  selaras: { theme: { colors: theme } },
  runtimeConfig: {
    // Nuxt Auth Utils seals the browser session with a key derived from
    // appSecret. Production derives it from JWT_SECRET before startup (see
    // scripts/start.mjs); NUXT_APP_SECRET stays available as an explicit
    // override. Declared here so the runtime env override is honored.
    appSecret: '',
    session: {
      // Keep the previous seven-day browser session lifetime.
      maxAge: 60 * 60 * 24 * 7,
      // Secure by default. nuxt.config is evaluated in development for
      // `bun run dev`, while the production start wrapper sets the env
      // override. Declaring the key is required for NUXT_SESSION_COOKIE_SECURE.
      cookie: { secure: process.env.NODE_ENV !== 'development' },
    },
  },
  // Selaras internal icons are overridden to Lucide in app.config.ts. Bundle
  // that collection locally so no icon request reaches the Iconify API.
  icon: {
    serverBundle: { collections: ['lucide'] },
    clientBundle: { scan: true, icons: [...selarasIconNames] },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#f8fafc', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#090a0d', media: '(prefers-color-scheme: dark)' },
      ],
      link: [
        { rel: 'preload', href: '/fonts/plus-jakarta-sans-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
      ],
    },
  },
  nitro: {
    experimental: {
      openAPI: true
    }
  },
  routeRules: {
    // Ask supporting browsers to send their color preference so shared HTML
    // artifacts render in the right mode without a flash.
    '/api/share/**': { headers: { 'Accept-CH': 'Sec-CH-Prefers-Color-Scheme' } },
    // The opt-in document theme loads its webfont inside a sandboxed iframe.
    // A sandboxed frame has an opaque origin, so the font request is a CORS
    // request; without this header only the fallback font ever renders.
    '/fonts/**': { headers: { 'Access-Control-Allow-Origin': '*' } },
  },
})
