import { defineConfig } from 'vite'
import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'

export default defineConfig({
  plugins: [
    devServer({
      entry: './src/index.tsx',
      adapter,
    }),
    build({
      entry: './src/index.tsx',
      outputDir: './dist',
    }),
  ],
})
