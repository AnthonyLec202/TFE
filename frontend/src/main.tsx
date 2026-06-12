import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './registerSyncHandlers' // wires feature sync handlers into the core engine (side effect)
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
