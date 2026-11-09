// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineColorFromSeed } from '@sewadah/selaras/theme'
import { selarasIconNames } from './shared/selaras-icons'
import { SITE_DESCRIPTION, SITE_NAME } from './shared/site'

// Design system generated with ui-ux-pro-max:
//   Minimalism & Swiss Style · variance 3 / motion 3 / density 5
//   Trust blue primary (#2563EB) with a warm orange call to action (#EA580C)
//   Plus Jakarta Sans for UI copy
const theme = {
  primary: defineColorFromSeed('#2563EB'),
  accent: defineColorFromSeed('#EA580C'),
}

// Shared with the pages and the manifest so the product name and pitch are
// defined once.

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
      // Pages set the short title only; the suffix lives here so the separator
      // and brand name cannot drift page to page. `%s` is replaced by the page
      // title, and a page with no title falls back to the product title (see
      // app/pages/index.vue). It must stay a string: Nuxt serializes app.head
      // with JSON.stringify, which silently drops function values. This also
      // applies to error.vue, which renders outside the normal app tree.
      titleTemplate: `%s · ${SITE_NAME}`,
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#f8fafc', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#090a0d', media: '(prefers-color-scheme: dark)' },
        { name: 'description', content: SITE_DESCRIPTION },
        { property: 'og:site_name', content: 'Serangkai' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        // A single-owner workspace is private by default. Only the landing page
        // opts back into indexing; see app/pages/index.vue.
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'preload', href: '/fonts/plus-jakarta-sans-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
        { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
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
