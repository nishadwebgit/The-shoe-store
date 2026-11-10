import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The ASP.NET Core API (shoe-store-api) listens on http://localhost:5080 in development.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:5080'

  // /api: the REST API. /media: product images uploaded through the Owner Portal (served by the API).
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/media': { target: apiTarget, changeOrigin: true },
  }

  return {
    plugins: [react()],
    server: {
      // Same-origin /api calls: no CORS preflights, and the HttpOnly refresh-token cookie just works.
      proxy,
    },
    preview: {
      proxy,
    },
  }
})
