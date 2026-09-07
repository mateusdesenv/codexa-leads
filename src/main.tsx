import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'codexa-ui/styles.css'
import './index.css'
import App from './App.tsx'

document.documentElement.setAttribute('data-theme', 'light')
localStorage.removeItem('codexa-theme')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
