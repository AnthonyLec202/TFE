import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
        name: 'NeuroPlatform',
        short_name: 'NeuroPlatform',
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
        ],
      },
    }),
  ],
})
