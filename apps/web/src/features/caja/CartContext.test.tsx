import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CartProvider, NO_CUSTOMER, useCart } from './CartContext'
import type { Product } from '@/features/catalog/useProducts'
import { createDraft, draftKey, parseDraft } from './cartDraft'

beforeEach(() => sessionStorage.clear())
afterEach(cleanup)

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider userId="test-user">{children}</CartProvider>
}

const product = { id: 'p1' } as Product
const currentProduct = {
  id: 'p1',
  name: 'Prueba',
  active: true,
  price: 30,
  price_per_100g: null,
  sold_by_weight: false,
} as Product

describe('useCart', () => {
  it('lanza si se usa fuera de <CartProvider>', () => {
    expect(() => renderHook(() => useCart())).toThrow(
      'useCart debe usarse dentro de <CartProvider>',
    )
  })

  it('arranca con el carrito vacío y el cliente en "sin cliente"', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    expect(result.current.cart).toEqual([])
    expect(result.current.customerId).toBe(NO_CUSTOMER)
  })
})

// syncCashSession es lo que permite que la venta en curso sobreviva a
// navegar a Catálogo/Inventario y volver -- pero no debe sobrevivir a un
// cambio de caja (cerrar y abrir una nueva sesión). Sin esta prueba,
// nada evitaría que una venta sin terminar de una caja ya cerrada se
// colara a la siguiente.
describe('syncCashSession', () => {
  it('no limpia el carrito la primera vez que se sincroniza (todavía no hay sesión previa que comparar)', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.setCart([{ product, quantity: 1 }])
      result.current.syncCashSession('session-a')
    })

    expect(result.current.cart).toHaveLength(1)
  })

  it('no limpia el carrito si la sesión de caja sigue siendo la misma (navegar y volver)', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.syncCashSession('session-a')
      result.current.setCart([{ product, quantity: 1 }])
    })
    act(() => {
      result.current.syncCashSession('session-a')
    })

    expect(result.current.cart).toHaveLength(1)
  })

  it('limpia el carrito y el resto del borrador si la sesión de caja cambió', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.syncCashSession('session-a')
      result.current.setCart([{ product, quantity: 1 }])
      result.current.setCashReceived('100')
      result.current.setPaymentMethodId('cash-method')
      result.current.setCustomerId('cliente-1')
    })
    act(() => {
      result.current.syncCashSession('session-b')
    })

    expect(result.current.cart).toEqual([])
    expect(result.current.cashReceived).toBe('')
    expect(result.current.paymentMethodId).toBe('')
    expect(result.current.customerId).toBe(NO_CUSTOMER)
  })
})

describe('Recuperación y deshacer', () => {
  it('recupera después de recargar y borra el borrador al completar la venta', () => {
    const first = renderHook(useCart, { wrapper })
    act(() => {
      first.result.current.syncCashSession('session-a')
      first.result.current.setCart([{ product: currentProduct, quantity: 2 }])
    })
    first.unmount()
    const next = renderHook(useCart, { wrapper })
    act(() => {
      next.result.current.syncCashSession('session-a')
    })
    expect(next.result.current.pendingDraft?.lines).toHaveLength(1)
    act(() => {
      next.result.current.recoverDraft([{ ...currentProduct, price: 40 }])
    })
    expect(next.result.current.cart[0].product.price).toBe(40)
    expect(next.result.current.cashReceived).toBe('')
    act(() => {
      next.result.current.resetSale()
    })
    expect(sessionStorage.getItem(draftKey('test-user'))).toBeNull()
  })

  it('no recupera ventas de otro usuario o caja', () => {
    const draft = createDraft(
      [{ product: currentProduct, quantity: 2 }],
      'old-session',
      null,
    )
    sessionStorage.setItem(draftKey('other-user'), JSON.stringify(draft))
    const first = renderHook(useCart, { wrapper })
    expect(first.result.current.pendingDraft).toBeNull()
    first.unmount()
    sessionStorage.setItem(draftKey('test-user'), JSON.stringify(draft))
    const next = renderHook(useCart, { wrapper })
    act(() => {
      next.result.current.syncCashSession('new-session')
    })
    expect(next.result.current.pendingDraft).toBeNull()
    expect(next.result.current.cart).toEqual([])
    expect(sessionStorage.getItem(draftKey('test-user'))).toBeNull()
  })

  it('mantiene el identificador del intento de cobro al recuperar', () => {
    const { result } = renderHook(useCart, { wrapper })
    act(() => {
      result.current.syncCashSession('session-a')
      result.current.setCart([{ product: currentProduct, quantity: 1 }])
    })
    let id = ''
    act(() => {
      id = result.current.beginCheckout()
      result.current.holdForVerification()
    })
    expect(
      parseDraft(sessionStorage.getItem(draftKey('test-user')))?.checkoutId,
    ).toBe(id)
    act(() => {
      result.current.recoverDraft([currentProduct])
    })
    expect(result.current.beginCheckout()).toBe(id)
  })

  it('deshace una eliminación sin perder productos añadidos después', () => {
    const { result } = renderHook(useCart, { wrapper })
    act(() => {
      result.current.setCart([{ product: currentProduct, quantity: 2 }])
    })
    act(() => {
      result.current.removeCartLine(0)
    })
    act(() => {
      result.current.setCart([{ product: currentProduct, quantity: 3 }])
    })
    act(() => {
      result.current.undoRemoval()
    })
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(5)
    act(() => {
      result.current.removeCartLine(0)
    })
    act(() => {
      result.current.resetSale()
    })
    act(() => {
      result.current.undoRemoval()
    })
    expect(result.current.cart).toEqual([])
  })

  it('deshace solo el renglón eliminado en ventas a granel', () => {
    const { result } = renderHook(useCart, { wrapper })
    const weighted = { ...currentProduct, sold_by_weight: true }
    act(() => {
      result.current.setCart([
        { product: weighted, quantity: 0.1 },
        { product: weighted, quantity: 0.5 },
      ])
    })
    act(() => {
      result.current.removeCartLine(0)
    })
    expect(result.current.cart[0].quantity).toBe(0.5)
    act(() => {
      result.current.undoRemoval()
    })
    expect(result.current.cart.map((line) => line.quantity)).toEqual([0.1, 0.5])
  })
})
