import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import type { Product } from '@/features/catalog/useProducts'

// amountMxn solo existe en líneas pedidas "por monto" ("dame $50 de
// piquín"): ahí el total de la línea es ese monto exacto y quantity es
// el peso derivado. En las demás líneas el total sale de quantity ×
// tarifa, como siempre.
export type CartLine = { product: Product; quantity: number; amountMxn?: number }

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
}

const CartContext = createContext<CartContextValue | null>(null)

// Vive envolviendo <Routes> en App.tsx (nunca se desmonta al navegar) --
// es lo que permite que la venta en curso sobreviva a ir a consultar
// Catálogo/Inventario y volver a Caja, en vez de perderse porque
// SaleScreen se desmontó al cambiar de ruta.
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const cashSessionIdRef = useRef<string | null>(null)

  // Memoizada con identidad estable (deps vacías: solo usa refs y los
  // setters de useState, que React garantiza estables) -- así SaleScreen
  // puede declararla como dependencia real de su efecto en vez de dejar
  // pasar el aviso de "dependencia faltante".
  const syncCashSession = useCallback((cashSessionId: string) => {
    if (cashSessionIdRef.current !== null && cashSessionIdRef.current !== cashSessionId) {
      setCart([])
      setCashReceived('')
      setPaymentMethodId('')
      setCustomerId(NO_CUSTOMER)
    }
    cashSessionIdRef.current = cashSessionId
  }, [])

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
