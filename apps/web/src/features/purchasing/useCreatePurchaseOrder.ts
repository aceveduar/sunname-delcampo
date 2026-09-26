import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'

export type PurchaseOrderInput = {
  supplierId: string
  notes: string | null
  ticketDate?: string | null
  items: { productId: string; quantity: number; unitCost: number }[]
}
/** Conserva el UUID cuando se desconoce el resultado; reintentar no duplica la compra. */
export function useCreatePurchaseOrder(onDone?: () => void | Promise<void>) {
  const pending = useRef<{ fingerprint: string; id: string } | null>(null)
  const busy = useRef(false)
  return useCallback(
    async (values: PurchaseOrderInput) => {
      if (busy.current) return false
      const fingerprint = JSON.stringify(values)
      if (pending.current && pending.current.fingerprint !== fingerprint) {
        toast.error(
          'El resultado de la orden anterior es incierto. Reintenta con los mismos datos antes de preparar otra compra.',
        )
        return false
      }
      pending.current ??= { fingerprint, id: crypto.randomUUID() }
      busy.current = true
      try {
        const { data, error } = await supabase.rpc('create_purchase_order', {
          p_client_uuid: pending.current.id,
          p_supplier_id: values.supplierId,
          p_notes: values.notes ?? undefined,
          p_ticket_date: values.ticketDate ?? undefined,
          p_items: values.items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_cost: item.unitCost,
          })),
        })
        if (error) {
          // Un rechazo explícito de PostgreSQL revierte toda la transacción.
          if (/^(P0001|22|23|42)/.test(error.code)) pending.current = null
          throw error
        }
        if (!data) throw new Error('Respuesta sin confirmación')
        pending.current = null
        toast.success('Orden de compra creada')
        try {
          await onDone?.()
        } catch (error) {
          reportError(
            'La orden se guardó, pero no se pudo actualizar la lista. Actualiza Compras.',
            error,
          )
        }
        return true
      } catch (error) {
        reportError(
          'No se pudo confirmar la orden. Conserva los datos y reintenta.',
          error,
        )
        return false
      } finally {
        busy.current = false
      }
    },
    [onDone],
  )
}
