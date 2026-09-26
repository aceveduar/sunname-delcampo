import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraft, draftKey, parseDraft, type CartDraft } from './cartDraft'
import type { CartLine } from './CartContext'

/** sessionStorage aísla pestañas; la clave aísla usuarios y proyectos. */
export function useCartDraft(userId: string, cart: CartLine[]) {
  const key = draftKey(userId)
  const [pendingDraft, setPendingDraft] = useState(() => {
    try {
      return parseDraft(sessionStorage.getItem(key))
    } catch {
      return null
    }
  })
  const [storageError, setStorageError] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const attemptId = useRef<string | null>(null)
  const persist = useCallback(
    (draft: CartDraft | null) => {
      try {
        if (draft) sessionStorage.setItem(key, JSON.stringify(draft))
        else sessionStorage.removeItem(key)
        setStorageError(false)
      } catch {
        setStorageError(true)
      }
    },
    [key],
  )

  useEffect(() => {
    if (!sessionId || pendingDraft) return
    persist(
      cart.length ? createDraft(cart, sessionId, attemptId.current) : null,
    )
  }, [cart, sessionId, pendingDraft, persist])

  const clearDraft = useCallback(() => {
    attemptId.current = null
    setPendingDraft(null)
    persist(null)
  }, [persist])

  const syncDraftSession = useCallback((id: string) => {
    setSessionId(id)
    setPendingDraft((previous) => {
      if (previous?.sessionId === id) return previous
      return null
    })
  }, [])

  const acceptDraft = useCallback(() => {
    attemptId.current = pendingDraft?.checkoutId ?? null
    setPendingDraft(null)
  }, [pendingDraft])

  const beginCheckout = () => {
    if (!sessionId) throw new Error('La caja no está lista')
    attemptId.current ??= crypto.randomUUID()
    persist(createDraft(cart, sessionId, attemptId.current))
    return attemptId.current
  }

  const holdForVerification = () => {
    if (sessionId)
      setPendingDraft(createDraft(cart, sessionId, attemptId.current))
  }

  return {
    pendingDraft,
    storageError,
    clearDraft,
    syncDraftSession,
    acceptDraft,
    beginCheckout,
    holdForVerification,
  }
}
