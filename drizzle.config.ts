import { defineConfig } from 'drizzle-kit'
import { getDatabaseProvider, getTursoConfig } from './server/db/provider'

const common = {
  schema: './server/db/schema.ts',
  out: './drizzle',
}

export default defineConfig(getDatabaseProvider() === 'turso' ? {
  ...common,
  dialect: 'turso',
  dbCredentials: getTursoConfig(),
} : {
  ...common,
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/serangkai.db',
  },
})
