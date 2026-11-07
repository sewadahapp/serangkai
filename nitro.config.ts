import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'node:path'

export default defineNitroConfig({
  // Override with NITRO_PRESET=cloudflare_module, vercel, or bun in CI.
  preset: process.env.NITRO_PRESET || 'node-server',
  replace: {
    // Nitro 2 does not statically replace `import.meta.preset`; expose the
    // target explicitly so platform-only drivers are tree-shaken correctly.
    __SERANGKAI_CLOUDFLARE__: JSON.stringify(process.env.NITRO_PRESET === 'cloudflare_module'),
  },
  vercel: {
    functions: {
      runtime: 'nodejs24.x',
    },
  },
  alias: {
    // The Cloudflare build must not pull better-sqlite3 into the Worker bundle.
    '#serangkai-db-runtime': process.env.NITRO_PRESET === 'cloudflare_module'
      ? resolve('server/db/runtime-edge.ts')
      : resolve('server/db/runtime-node.ts'),
  },
})
