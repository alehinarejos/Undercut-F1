import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './context/LanguageContext'
import { LiveSessionProvider } from './context/LiveSessionProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <LiveSessionProvider>
        <App />
      </LiveSessionProvider>
    </LanguageProvider>
  </StrictMode>,
)
