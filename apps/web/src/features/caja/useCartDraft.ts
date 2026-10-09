import { useCallback, useEffect, useRef, useState } from 'react'
import { createDraft, draftKey, type CartDraft } from './cartDraft'
import type { CartLine } from './CartContext'
import { readCartDraft } from './heldSaleStorage'

/** sessionStorage aísla pestañas; la clave aísla usuarios y proyectos. */
export function useCartDraft(
  userId: string,
  cart: CartLine[],
  customerId: string,
) {
  const key = draftKey(userId)
  const [initial] = useState(() => {
    try {
      return { draft: readCartDraft(userId), failed: false }
    } catch {
      return { draft: null, failed: true }
    }
  })
  const [pendingDraft, setPendingDraft] = useState(initial.draft)
  const [draftReadError, setDraftReadError] = useState(initial.failed)
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
    if (!sessionId || pendingDraft || draftReadError) return
    persist(
      cart.length
        ? createDraft(cart, sessionId, attemptId.current, customerId)
        : null,
    )
  }, [cart, sessionId, pendingDraft, persist, customerId, draftReadError])

  const clearDraft = useCallback(() => {
    if (draftReadError) return
    attemptId.current = null
    setPendingDraft(null)
    persist(null)
  }, [persist, draftReadError])

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
    if (!sessionId || draftReadError) throw new Error('La caja no está lista')
    attemptId.current ??= crypto.randomUUID()
    persist(createDraft(cart, sessionId, attemptId.current, customerId))
    return attemptId.current
  }

  const holdForVerification = () => {
    if (sessionId)
      setPendingDraft(
        createDraft(cart, sessionId, attemptId.current, customerId),
      )
  }

  return {
    pendingDraft,
    storageError: storageError || draftReadError,
    draftReadError,
    retryDraftRead: () => {
      try {
        const draft = readCartDraft(userId)
        setPendingDraft(
          !sessionId || draft?.sessionId === sessionId ? draft : null,
        )
        setDraftReadError(false)
      } catch {
        setDraftReadError(true)
      }
    },
    clearDraft,
    syncDraftSession,
    acceptDraft,
    beginCheckout,
    holdForVerification,
    hasCheckoutAttempt: () => attemptId.current !== null,
  }
}
