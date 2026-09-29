import { useState } from 'react'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { usePendingWrites } from '@/lib/pendingWrites'
import { Button } from '@/components/ui/button'

export function AppUpdateNotice({
  hasPendingSale,
}: {
  hasPendingSale: boolean
}) {
  const available = useAppUpdate()
  const writes = usePendingWrites()
  const [message, setMessage] = useState('')
  if (!available) return null
  function reload() {
    // Comprobación al pulsar: nunca recargar detrás de un formulario o diálogo.
    let pending = true
    try {
      pending = Object.keys(sessionStorage).some(
        (key) =>
          key.startsWith('cash-movement:') ||
          key.startsWith('purchase-delivery:'),
      )
    } catch {
      /* Sin poder comprobar los borradores, no recargar. */
    }
    if (
      hasPendingSale ||
      writes ||
      pending ||
      document.querySelector('form, [role="dialog"], [role="alertdialog"]')
    ) {
      setMessage(
        'Termina la operación pendiente y cierra los formularios antes de actualizar.',
      )
      return
    }
    window.location.reload()
  }
  return (
    <aside
      role="status"
      className="bg-muted mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
    >
      <div>
        <p className="font-medium">Hay una nueva versión disponible</p>
        <p>
          {message ||
            (hasPendingSale || writes
              ? 'Termina la operación pendiente para actualizar.'
              : 'Actualiza cuando hayas terminado tus operaciones.')}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={hasPendingSale || writes > 0}
        onClick={reload}
      >
        Actualizar aplicación
      </Button>
    </aside>
  )
}
