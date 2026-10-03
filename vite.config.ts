import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const token = env.ALERTS_IN_UA_TOKEN
  const target = token ? 'https://api.alerts.in.ua' : 'https://api.alerts.in.ua'
  const apiPath = token ? '/v1/alerts/active.json' : '/v3/alerts/active.md'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/alerts/active': {
          target,
          changeOrigin: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          rewrite: () => apiPath,
        },
      },
    },
  }
})
