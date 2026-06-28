import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './registerSyncHandlers' // wires feature sync handlers into the core engine (side effect)
import App from './App.tsx'
import { NetworkStateProvider } from './core/offline/NetworkStateProvider'

// Register the Service Worker immediately. With `registerType: 'autoUpdate'` the worker
// reloads itself silently whenever a new build is deployed.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Hoisted above App (and therefore above the Router inside it): the reachability state and its
        background poll persist across every route change, so no page re-seeds or re-pings on mount. */}
    <NetworkStateProvider>
      <App />
    </NetworkStateProvider>
  </StrictMode>,
)
