import { toast } from 'sonner'
import { Sentry } from './sentry'

/** Avisa al usuario y manda el error a Sentry en un solo paso -- para
 * las rutas donde un fallo silencioso de verdad duele (Caja). */
export function reportError(userMessage: string, error: unknown) {
  const description = error instanceof Error ? error.message : String(error)
  toast.error(userMessage, { description })
  Sentry.captureException(error, { extra: { userMessage } })
}
