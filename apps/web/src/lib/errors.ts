import { toast } from 'sonner'
import { Sentry } from './sentry'

// Los errores de Supabase (PostgrestError, AuthError) son objetos planos
// con .message, no instancias de Error -- sin este caso, description caía
// en String(error) y el cajero veía literalmente "[object Object]".
function describeError(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

/** Avisa al usuario y manda el error a Sentry en un solo paso -- para
 * las rutas donde un fallo silencioso de verdad duele (Caja). */
export function reportError(userMessage: string, error: unknown) {
  toast.error(userMessage, { description: describeError(error) })
  Sentry.captureException(error, { extra: { userMessage } })
}
