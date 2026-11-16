import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'node:path'

export default defineNitroConfig({
  // Override with NITRO_PRESET=cloudflare_module, vercel, or bun in CI.
  preset: process.env.NITRO_PRESET || 'node-server',
  externals: {
    // Resolve libSQL's conditional exports at build time. Tracing only the
    // Node entry leaves isomorphic-ws/web.mjs missing when Bun runs the same
    // node-server output. Only the network client is imported by the adapter.
    inline: ['drizzle-orm', '@libsql/client', '@libsql/core', '@libsql/hrana-client', '@libsql/isomorphic-ws'],
  },
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
