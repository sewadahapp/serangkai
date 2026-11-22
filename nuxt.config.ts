// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineColorFromSeed } from '@sewadah/selaras/theme'
import { selarasIconNames } from './shared/selaras-icons'
import { SITE_DESCRIPTION, SITE_NAME } from './shared/site'

// The default "Serangkai" theme: ivory porcelain surfaces, a jade lacquer
// primary, and a scarlet signal accent used sparingly (the logo's piece, a
// highlight). Seeds derive against the theme's own surfaces so text and fill
// contrast is checked on ivory and on the jade-tinted dark, not on white.
// Surfaces, text, and borders live in app/assets/css/main.css; keep
// RANGKA_THEME_VALUES.serangkai in shared/selaras-tokens.ts in step.
const surfaces = { light: '#FDFBF6', dark: '#151A18' }
const theme = {
  primary: defineColorFromSeed('#0B7A5E', { surfaces }),
  accent: defineColorFromSeed('#E0281E', { surfaces }),
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
        { name: 'theme-color', content: '#f7f3ea', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0f1312', media: '(prefers-color-scheme: dark)' },
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
    // rangka render in the right mode without a flash.
    '/api/share/**': { headers: { 'Accept-CH': 'Sec-CH-Prefers-Color-Scheme' } },
    // The opt-in document theme loads its webfont inside a sandboxed iframe.
    // A sandboxed frame has an opaque origin, so the font request is a CORS
    // request; without this header only the fallback font ever renders.
    '/fonts/**': { headers: { 'Access-Control-Allow-Origin': '*' } },
  },
})
