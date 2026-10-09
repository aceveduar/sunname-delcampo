import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCart } from '@/features/caja/CartContext'
import { createDraft } from '@/features/caja/cartDraft'
import { readCartDraft } from '@/features/caja/heldSaleStorage'
import { usePendingWrites } from '@/lib/pendingWrites'

export function ModuleRecovery({
  userId,
  retry,
}: {
  userId: string
  retry: () => void
}) {
  const { cart, pendingDraft, storageError, customerId, transferBusy } =
    useCart()
  const writes = usePendingWrites()
  const [message, setMessage] = useState('')
  function reload() {
    if (writes || transferBusy) return
    try {
      const saved = readCartDraft(userId)
      if (
        storageError ||
        (pendingDraft &&
          JSON.stringify(saved) !== JSON.stringify(pendingDraft)) ||
        (cart.length > 0 &&
          !pendingDraft &&
          (!saved ||
            JSON.stringify(saved) !==
              JSON.stringify(
                createDraft(
                  cart,
                  saved.sessionId,
                  saved.checkoutId,
                  customerId,
                ),
              )))
      ) {
        setMessage(
          'No se pudo verificar el respaldo de la venta. Mantén esta pestaña abierta y usa Reintentar.',
        )
        return
      }
      window.location.reload()
    } catch {
      setMessage(
        'No se pudo acceder al respaldo local. Mantén esta pestaña abierta y usa Reintentar.',
      )
    }
  }
  return (
    <section role="alert" className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">No se pudo abrir esta pantalla</h2>
      <p>
        Puede deberse a una conexión interrumpida o a una actualización.
        Reintenta primero; si persiste, recarga la aplicación.
      </p>
      {(cart.length > 0 || pendingDraft) && (
        <p>
          Hay una venta pendiente. Antes de recargar comprobaremos su respaldo;
          al volver podrás revisar el borrador. Tendrás que volver a capturar el
          pago.
        </p>
      )}
      {writes > 0 && <p>Espera a que termine la operación en curso.</p>}
      {message && <p>{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={retry} disabled={writes > 0}>
          Reintentar
        </Button>
        <Button
          variant="outline"
          onClick={reload}
          disabled={writes > 0 || storageError || transferBusy}
        >
          Recargar aplicación
        </Button>
      </div>
      {storageError && (
        <p>
          No hay un respaldo local confirmado. Conserva esta pestaña abierta.
        </p>
      )}
    </section>
  )
}
