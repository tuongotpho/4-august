import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AiConsentPage from './AiConsentPage'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.pathname.startsWith('/ket-noi-ai') ? <AiConsentPage /> : <App />}
  </StrictMode>,
)
