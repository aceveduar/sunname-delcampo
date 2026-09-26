import { useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function ConnectionStatus() {
  const online = useOnlineStatus()
  const wasOffline = useRef(!online)
  const [restored, setRestored] = useState(false)
  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    setRestored(true)
    const timer = window.setTimeout(() => setRestored(false), 6000)
    return () => window.clearTimeout(timer)
  }, [online])
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {(!online || restored) && (
        <p className="bg-muted border-b px-4 py-3 text-center text-sm">
          {online
            ? 'Conexión de red recuperada. Reintenta las operaciones pendientes.'
            : 'Sin conexión de red. Puedes revisar los datos cargados; para cobrar necesitas conexión. Si hay un cobro pendiente, verifica su estado antes de continuar.'}
        </p>
      )}
    </div>
  )
}
