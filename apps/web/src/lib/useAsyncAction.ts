import { useRef, useState } from 'react'
import { reportError } from './errors'

/** Bloquea también dos envíos antes del siguiente render y libera el bloqueo al fallar. */
export function useAsyncAction(errorMessage: string) {
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<boolean>) => {
    if (pendingRef.current) return false
    pendingRef.current = true
    setPending(true)
    setError(null)
    try {
      const ok = await action()
      if (!ok) setError(errorMessage)
      return ok
    } catch (cause) {
      reportError(errorMessage, cause)
      setError(errorMessage)
      return false
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  return { run, pending, pendingRef, error, clearError: () => setError(null) }
}
