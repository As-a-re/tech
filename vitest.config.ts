import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { config } from 'dotenv'
config({ path: '.env.local' })

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false, // test files share one database
    server: { deps: { inline: ['server-only'] } },
    alias: { 'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts') },
  },
})
