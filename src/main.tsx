import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initSettings } from './db/settings'
import { requestPersistentStorage } from './lib/storage'
import './styles/global.css'

// Service worker : mise en cache hors ligne + mise à jour automatique.
// On vérifie s'il existe une nouvelle version à chaque retour dans l'appli et toutes les heures.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const checkForUpdate = () => void registration.update().catch(() => {})
    setInterval(checkForUpdate, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
  },
})

void requestPersistentStorage()
void initSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
