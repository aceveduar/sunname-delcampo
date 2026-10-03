import { toast } from 'sonner'
import { Sentry } from './sentry'
import { errorMessage } from './errorMessage'

/** Avisa al usuario y manda el error a Sentry en un solo paso -- para
 * las rutas donde un fallo silencioso de verdad duele (Caja). */
export function reportError(
  userMessage: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  toast.error(userMessage, { description: errorMessage(error) })
  Sentry.captureException(error, { extra: { userMessage, ...extra } })
}
