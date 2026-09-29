import { useEffect, useState } from 'react'
declare const __APP_VERSION__: string

export function useAppUpdate(
  current = __APP_VERSION__,
  enabled = import.meta.env.PROD,
) {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let checking = false
    const check = async () => {
      if (
        checking ||
        !navigator.onLine ||
        document.visibilityState === 'hidden'
      )
        return
      checking = true
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
          { cache: 'no-store', signal: controller.signal },
        )
        if (!response.ok) return
        const data: unknown = await response.json()
        if (
          !controller.signal.aborted &&
          data &&
          typeof data === 'object' &&
          'version' in data &&
          typeof data.version === 'string' &&
          data.version.length > 0
        )
          setAvailable(data.version !== current)
      } catch {
        /* Un fallo de red no implica que exista una actualización. */
      } finally {
        checking = false
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 60000)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    return () => {
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
    }
  }, [current, enabled])
  return available
}
