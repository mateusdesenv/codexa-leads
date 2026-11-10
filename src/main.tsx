import { initializeCentralSession } from './central-session'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'codexa-ui/styles.css'
import './index.css'
import App from './App.tsx'
import Login from './Login'
import './dark-mode.css'

const root = document.getElementById('root')!
initializeCentralSession().then((redirecting) => {
  if (!redirecting) createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}).catch(() => { createRoot(root).render(<Login message="Sua entrada expirou ou foi interrompida. Continue pelo Hub para tentar novamente." />) })
