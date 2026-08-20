import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

// Solo se activa si hay DSN configurado y en el build de producción --
// así pnpm dev nunca manda ruido de pruebas locales a Sentry.
export function initSentry() {
  if (!dsn || !import.meta.env.PROD) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
  })
}

export { Sentry }
