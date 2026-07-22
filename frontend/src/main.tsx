import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts' // self-hosted web fonts (bundled + precached), replaces the Google Fonts CDN
import './index.css'
import './registerSyncHandlers' // wires feature sync handlers into the core engine (side effect)
import App from './App.tsx'
import { NetworkStateProvider } from './core/offline/NetworkStateProvider'
import { PwaUpdatePrompt } from './components/layout/PwaUpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hoisted above App (and therefore above the Router inside it): the reachability state and its
        background poll persist across every route change, so no page re-seeds or re-pings on mount. */}
    <NetworkStateProvider>
      <App />
      {/* Service-worker update / offline-ready toast. Self-registers the SW via useRegisterSW. */}
      <PwaUpdatePrompt />
    </NetworkStateProvider>
  </StrictMode>,
)
