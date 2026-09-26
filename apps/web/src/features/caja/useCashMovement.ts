import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type CashMovementInput = {
  direction: 'in' | 'out'
  amount: number
  reason: string
}
type Request = CashMovementInput & { id: string }

function readPending(key: string): Request | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  const value = JSON.parse(raw) as Request
  if (
    !value ||
    typeof value.id !== 'string' ||
    !['in', 'out'].includes(value.direction) ||
    !Number.isFinite(value.amount) ||
    typeof value.reason !== 'string'
  )
    throw new Error('Solicitud guardada inválida')
  return value
}

/** Persiste antes de enviar; un resultado incierto solo admite el mismo reintento. */
export function useCashMovement(sessionId: string, userId: string) {
  const key = `cash-movement:${import.meta.env.VITE_SUPABASE_URL}:${userId}:${sessionId}`
  const [initial] = useState(() => {
    try {
      return { pending: readPending(key), error: null }
    } catch {
      return {
        pending: null,
        error:
          'No se pudo recuperar el movimiento pendiente. Revisa el almacenamiento del navegador antes de continuar.',
      }
    }
  })
  const [pending, setPending] = useState<Request | null>(initial.pending)
  const [error, setError] = useState<string | null>(initial.error)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)

  async function submit(input: CashMovementInput) {
    if (locked.current || initial.error || !navigator.onLine) return false
    locked.current = true
    setBusy(true)
    setError(null)
    const request = pending ?? {
      ...input,
      reason: input.reason.trim(),
      id: crypto.randomUUID(),
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(request))
      setPending(request)
      const { data, error: failure } = await supabase.rpc(
        'record_cash_movement',
        {
          p_client_uuid: request.id,
          p_session_id: sessionId,
          p_direction: request.direction,
          p_amount: request.amount,
          p_reason: request.reason,
        },
      )
      if (failure) {
        if (/^(P0001|22|23|42)/.test(failure.code)) {
          sessionStorage.removeItem(key)
          setPending(null)
          setError(
            failure.code === 'P0001'
              ? failure.message
              : 'El movimiento fue rechazado. Revisa los datos.',
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
        'No se pudo confirmar el movimiento. Reintenta con los mismos datos; no vuelvas a entregar ni retirar efectivo.',
      )
      return false
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { pending, error, busy, submit, blocked: !!initial.error }
}
