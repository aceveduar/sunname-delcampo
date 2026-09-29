import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type DeliveryInput = {
  items: { item_id: string; quantity: number }[]
  notes: string
}
type PendingDelivery = DeliveryInput & { id: string }
export function usePurchaseDelivery(orderId: string, userId: string) {
  const key = `purchase-delivery:${import.meta.env.VITE_SUPABASE_URL}:${userId}:${orderId}`
  const [initial] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      const value: PendingDelivery | null = raw ? JSON.parse(raw) : null
      if (
        value &&
        (typeof value.id !== 'string' ||
          typeof value.notes !== 'string' ||
          !Array.isArray(value.items) ||
          !value.items.every(
            (item) =>
              typeof item?.item_id === 'string' &&
              Number.isFinite(item.quantity),
          ))
      )
        throw new Error('Borrador inválido')
      return { pending: value, blocked: false }
    } catch {
      return { pending: null, blocked: true }
    }
  })
  const [pending, setPending] = useState(initial.pending)
  const [error, setError] = useState<string | null>(
    initial.blocked
      ? 'No se pudo leer la recepción pendiente. Revisa el almacenamiento del navegador.'
      : null,
  )
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function submit(input: DeliveryInput) {
    if (lock.current || initial.blocked || !navigator.onLine) return false
    lock.current = true
    setBusy(true)
    setError(null)
    const request = pending ?? { ...input, id: crypto.randomUUID() }
    try {
      sessionStorage.setItem(key, JSON.stringify(request))
      setPending(request)
      const { data, error: failure } = await supabase.rpc(
        'receive_purchase_delivery',
        {
          p_client_uuid: request.id,
          p_purchase_order_id: orderId,
          p_items: request.items,
          p_notes: request.notes,
        },
      )
      if (failure) {
        if (/^(P0001|22|23|42)/.test(failure.code)) {
          sessionStorage.removeItem(key)
          setPending(null)
          setError(
            failure.code === 'P0001'
              ? failure.message
              : 'La recepción fue rechazada. Revisa los datos.',
          )
          return false
        }
        throw failure
      }
      if (!data) throw new Error('Sin confirmación')
      sessionStorage.removeItem(key)
      setPending(null)
      return true
    } catch {
      setError(
        'No se pudo confirmar la entrega. Reintenta con los mismos datos; no registres otra recepción para esta mercancía.',
      )
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { pending, error, busy, blocked: initial.blocked, submit }
}
