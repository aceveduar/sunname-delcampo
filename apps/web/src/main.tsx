import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { ErrorFallback } from '@/components/ErrorFallback'
import { initSentry, Sentry } from '@/lib/sentry'
import './index.css'
import App from './App.tsx'

initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
        <Toaster />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
