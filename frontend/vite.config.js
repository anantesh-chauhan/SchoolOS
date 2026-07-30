import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const normalizeBase = (value) => {
  const trimmed = String(value || '/').trim()
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}${trimmed === '/' ? '' : '/'}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = normalizeBase(env.VITE_BASE_PATH)

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: [
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: base,
          name: 'SchoolOS',
          short_name: 'SchoolOS',
          description: 'A complete digital management, learning and communication platform for schools.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#F8FAFC',
          theme_color: '#0F766E',
          categories: ['education', 'productivity'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,ico,webp}'],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => (
                request.destination === 'font'
                && url.origin === self.location.origin
              ),
              handler: 'CacheFirst',
              options: {
                cacheName: 'schoolos-versioned-fonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
    },
  }
})
