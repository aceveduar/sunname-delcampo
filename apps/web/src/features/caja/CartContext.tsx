import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCartDraft } from './useCartDraft'
import { restoreDraft } from './cartDraft'
import type { CartDraft } from './cartDraft'
import type { Product } from '@/features/catalog/useProducts'

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
  recoverDraft: (products: Product[]) => { omitted: number; repriced: number }
  beginCheckout: () => string
  holdForVerification: () => void
  resetSale: () => void
  removedLine: CartLine | null
  removeCartLine: (index: number) => void
  undoRemoval: () => void
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
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const {
    pendingDraft,
    storageError,
    clearDraft,
    syncDraftSession,
    acceptDraft,
    beginCheckout,
    holdForVerification,
  } = useCartDraft(userId, cart)
  const [removed, setRemoved] = useState<{
    line: CartLine
    index: number
  } | null>(null)
  const resetSale = useCallback(() => {
    setCart([])
    setCashReceived('')
    setPaymentMethodId('')
    setCustomerId(NO_CUSTOMER)
    setRemoved(null)
    clearDraft()
  }, [clearDraft])
  const recoverDraft = (products: Product[]) => {
    if (!pendingDraft) return { omitted: 0, repriced: 0 }
    const restored = restoreDraft(pendingDraft, products)
    setCart(restored.cart)
    setCashReceived('')
    setCustomerId(NO_CUSTOMER)
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
        discardDraft: resetSale,
        recoverDraft,
        beginCheckout,
        holdForVerification,
        resetSale,
        removedLine: removed?.line ?? null,
        removeCartLine,
        undoRemoval,
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
