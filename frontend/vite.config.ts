import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Paths the deployed frontend serves from its own origin by proxying them to the App Service
// (see the `rewrites` in vercel.json). Kept in one place because three separate mechanisms must
// agree on them: the dev-server proxy below, the service worker's bypass rules, and vercel.json.
const API_PATH_PREFIXES = ['/api', '/hubs', '/health'] as const

export default defineConfig(({ mode }) => {
  // Dev-server proxy target. Defaults to a locally running API; point VITE_DEV_API_TARGET at the
  // deployed App Service to develop against it instead.
  const env = loadEnv(mode, process.cwd())
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5043'

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // A freshly deployed build installs but waits; the in-app PwaUpdatePrompt applies it on the
        // user's command (no silent mid-session reload). Pairs with useRegisterSW's needRefresh flag.
        registerType: 'prompt',
        // Static assets copied verbatim from `public/` and added to the precache manifest.
        includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable.svg'],
        manifest: {
          name: 'Kideo',
          short_name: 'Kideo',
          description: 'Local-first clinical platform for neuropsychological patient management.',
          theme_color: '#1F6F6B',
          background_color: '#F7F5F1',
          display: 'standalone',
          // French UI locale, stable app identity, and installer/store categorisation.
          lang: 'fr',
          dir: 'ltr',
          id: '/',
          categories: ['medical', 'productivity'],
          icons: [
            // "any" icons render as authored (rounded-rect brand mark). The maskable variant is a
            // dedicated full-bleed asset, so Android's adaptive-icon mask never crops brand content.
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
              src: 'pwa-maskable.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Precache the full application shell — including the self-hosted woff2 fonts — so it
          // boots and renders with its typefaces entirely offline, with no third-party requests.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // The API is same-origin now that vercel.json proxies it, so navigateFallback would happily
          // answer an API path with index.html. Excluded here; served network-only below.
          navigateFallbackDenylist: [/^\/api\//, /^\/hubs\//, /^\/health$/],
          runtimeCaching: [
            {
              // The local LLM runtime (Ollama) must never be routed through a caching strategy, and
              // this rule is declared first so no later, broader pattern can claim it. Two ways a
              // cached handler breaks it: cache.put() with a POST Request throws a TypeError, and any
              // handler that clones the response to store it buffers the streamed NDJSON, destroying
              // incremental delivery. NetworkOnly makes the pass-through explicit rather than relying
              // on the absence of a matching route.
              urlPattern: ({ url }) => url.port === '11434',
              handler: 'NetworkOnly',
            },
            {
              // Same reasoning as Ollama, now that the API shares the application's origin: POST
              // requests cannot be cached at all, and a handler that clones the response to store it
              // buffers SignalR's Server-Sent Events stream — which is the transport the realtime
              // features actually run on, the Vercel proxy being unable to tunnel a WebSocket
              // upgrade. Caching an authenticated response would also risk serving one clinician's
              // data to another.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && API_PATH_PREFIXES.some(prefix => url.pathname.startsWith(prefix)),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    server: {
      // Mirrors the production rewrites so development runs the same single-origin topology. Without
      // it the dev server on localhost:5173 would call the API cross-site, and the SameSite=Lax
      // session cookie would be dropped — reintroducing locally the exact failure this architecture
      // removes in production. `ws` is enabled on the hub path so SignalR keeps a real WebSocket in
      // development; the client negotiates the transport, so the production fallback to SSE needs no
      // code change.
      proxy: Object.fromEntries(
        API_PATH_PREFIXES.map(prefix => [
          prefix,
          { target: devApiTarget, changeOrigin: true, ws: prefix === '/hubs' },
        ]),
      ),
    },
  }
})
