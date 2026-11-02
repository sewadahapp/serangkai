import { defineNitroConfig } from 'nitropack/config'
import { resolve } from 'node:path'

export default defineNitroConfig({
  // Override with NITRO_PRESET=cloudflare_module or NITRO_PRESET=vercel in CI.
  preset: process.env.NITRO_PRESET || 'node-server',
  vercel: {
    functions: {
      runtime: 'nodejs24.x',
    },
  },
  alias: {
    '#serangkai-db-runtime': process.env.NITRO_PRESET === 'cloudflare_module'
      ? resolve('server/db/runtime-edge.ts')
      : resolve('server/db/runtime-node.ts'),
    '#serangkai-storage-runtime': process.env.NITRO_PRESET === 'cloudflare_module'
      ? resolve('server/storage/runtime-edge.ts')
      : resolve('server/storage/runtime-node.ts'),
    '#serangkai-bundles-runtime': process.env.NITRO_PRESET === 'cloudflare_module'
      ? resolve('server/utils/bundles-runtime-edge.ts')
      : resolve('server/utils/bundles-runtime-node.ts'),
  },
})
