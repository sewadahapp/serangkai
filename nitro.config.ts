import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  // Override with NITRO_PRESET=cloudflare_module or NITRO_PRESET=vercel in CI.
  preset: process.env.NITRO_PRESET || 'node-server',
  vercel: {
    functions: {
      runtime: 'nodejs24.x',
    },
  },
})
