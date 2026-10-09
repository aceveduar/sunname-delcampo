import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCartDraft } from './useCartDraft'
import { createDraft, restoreDraft, type CartDraft } from './cartDraft'
import type { Product } from '@/features/catalog/useProducts'
import { createHeldSale, type HeldSale } from './heldSales'
import { parkSale, takeHeldSale, discardHeldSale } from './heldSaleStorage'
import { useHeldSales } from './useHeldSales'
import type { HeldSaleReview } from './reviewHeldSale'

// amountMxn solo existe en líneas pedidas "por monto" ("dame $50 de
// piquín"): ahí el total de la línea es ese monto exacto y quantity es
// el peso derivado. En las demás líneas el total sale de quantity ×
// tarifa, como siempre.
export type CartLine = {
  product: Product
  quantity: number
  amountMxn?: number
}

export const NO_CUSTOMER = 'none'

type CartContextValue = {
  cart: CartLine[]
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  cashReceived: string
  setCashReceived: (value: string) => void
  customerId: string
  setCustomerId: (id: string) => void
  /** Sincroniza la venta en curso con la caja abierta: si el cajero sigue
   * en la misma sesión, no toca nada (así navegar a Catálogo/Inventario y
   * volver conserva el carrito); si la sesión cambió (se cerró y se
   * abrió una nueva), limpia el borrador -- una venta sin terminar de
   * una caja ya cerrada no debe colarse a la siguiente. */
  syncCashSession: (cashSessionId: string) => void
  pendingDraft: CartDraft | null
  storageError: boolean
  discardDraft: () => void
  recoverDraft: (
    products: Product[],
    customerId?: string,
  ) => { omitted: number; repriced: number }
  draftReadError: boolean
  retryDraftRead: () => void
  beginCheckout: () => string
  holdForVerification: () => void
  resetSale: () => void
  removedLine: CartLine | null
  removeCartLine: (index: number) => void
  undoRemoval: () => void
  heldSales: HeldSale[]
  heldSalesError: string | null
  transferBusy: boolean
  holdSale: (label: string, customerName: string | null) => Promise<void>
  resumeSale: (
    id: string,
    review: HeldSaleReview,
    sessionId: string,
  ) => Promise<void>
  discardHeld: (id: string) => Promise<void>
  refreshHeld: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

// Vive envolviendo <Routes> en App.tsx (nunca se desmonta al navegar) --
// es lo que permite que la venta en curso sobreviva a ir a consultar
// Catálogo/Inventario y volver a Caja, en vez de perderse porque
// SaleScreen se desmontó al cambiar de ruta.
export function CartProvider({
  children,
  userId,
}: {
  children: ReactNode
  userId: string
}) {
  const [cart, updateCart] = useState<CartLine[]>([])
  const held = useHeldSales(userId)
  const setCart: React.Dispatch<React.SetStateAction<CartLine[]>> = (next) => {
    if (!held.busyRef.current) updateCart(next)
  }
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const {
    pendingDraft,
    storageError,
    clearDraft,
    syncDraftSession,
    acceptDraft,
    beginCheckout: startCheckout,
    holdForVerification,
    hasCheckoutAttempt,
    draftReadError,
    retryDraftRead,
  } = useCartDraft(userId, cart, customerId)
  const [removed, setRemoved] = useState<{
    line: CartLine
    index: number
  } | null>(null)
  const resetSale = useCallback(() => {
    updateCart([])
    setCashReceived('')
    setPaymentMethodId('')
    setCustomerId(NO_CUSTOMER)
    setRemoved(null)
    clearDraft()
  }, [clearDraft])
  const recoverDraft = (products: Product[], validatedCustomerId?: string) => {
    if (!pendingDraft) return { omitted: 0, repriced: 0 }
    const restored = restoreDraft(pendingDraft, products)
    setCart(restored.cart)
    setCashReceived('')
    setCustomerId(validatedCustomerId ?? pendingDraft.customerId ?? NO_CUSTOMER)
    setRemoved(null)
    acceptDraft()
    return restored
  }
  const removeCartLine = (index: number) => {
    const line = cart[index]
    if (!line) return
    setRemoved({ line, index })
    setCart((previous) => previous.filter((_, i) => i !== index))
  }
  const undoRemoval = () => {
    if (!removed) return
    const { line, index } = removed
    setCart((previous) => {
      const existing =
        !line.product.sold_by_weight &&
        previous.find((item) => item.product.id === line.product.id)
      if (existing)
        return previous.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + line.quantity }
            : item,
        )
      const next = [...previous]
      next.splice(Math.min(index, next.length), 0, line)
      return next
    })
    setRemoved(null)
  }
  const cashSessionIdRef = useRef<string | null>(null)
  const beginCheckout = () => {
    if (held.busyRef.current)
      throw new Error('Espera a que termine la operación actual.')
    return startCheckout()
  }
  const holdSale = (label: string, customerName: string | null) =>
    held.run(async () => {
      const sessionId = cashSessionIdRef.current
      const guard = () => {
        if (
          !sessionId ||
          cashSessionIdRef.current !== sessionId ||
          !cart.length ||
          pendingDraft ||
          hasCheckoutAttempt() ||
          draftReadError
        )
          throw new Error(
            'Termina de verificar la venta actual antes de ponerla en espera.',
          )
      }
      guard()
      await parkSale(
        userId,
        createHeldSale(cart, sessionId!, customerId, customerName, label),
        guard,
      )
      resetSale()
    })
  const resumeSale = (id: string, review: HeldSaleReview, sessionId: string) =>
    held.run(async () => {
      const guard = () => {
        if (
          cart.length ||
          pendingDraft ||
          hasCheckoutAttempt() ||
          draftReadError
        )
          throw new Error(
            'Pon la venta actual en espera o termínala antes de retomar otra.',
          )
        if (cashSessionIdRef.current !== sessionId)
          throw new Error('La sesión de caja cambió. Revisa la venta de nuevo.')
        if (!review.cart.length)
          throw new Error('Esta venta no tiene productos disponibles.')
      }
      await takeHeldSale(
        userId,
        id,
        createDraft(review.cart, sessionId, null, review.customerId),
        guard,
      )
      updateCart(review.cart)
      setCustomerId(review.customerId)
      setCashReceived('')
      setPaymentMethodId('')
      setRemoved(null)
    })

  // Las dependencias son callbacks estables; navegar entre módulos no
  // vuelve a sincronizar ni borra una venta de la misma sesión.
  const syncCashSession = useCallback(
    (cashSessionId: string) => {
      if (
        cashSessionIdRef.current !== null &&
        cashSessionIdRef.current !== cashSessionId
      ) {
        resetSale()
      }
      cashSessionIdRef.current = cashSessionId
      syncDraftSession(cashSessionId)
    },
    [resetSale, syncDraftSession],
  )

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        paymentMethodId,
        setPaymentMethodId,
        cashReceived,
        setCashReceived,
        customerId,
        setCustomerId,
        syncCashSession,
        pendingDraft,
        storageError,
        draftReadError,
        retryDraftRead,
        discardDraft: resetSale,
        recoverDraft,
        beginCheckout,
        holdForVerification,
        resetSale,
        removedLine: removed?.line ?? null,
        removeCartLine,
        undoRemoval,
        heldSales: held.sales,
        heldSalesError: held.error,
        transferBusy: held.busy,
        holdSale,
        resumeSale,
        discardHeld: (id) => held.run(() => discardHeldSale(userId, id)),
        refreshHeld: held.refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}
