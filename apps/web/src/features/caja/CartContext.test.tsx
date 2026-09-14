import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CartProvider, NO_CUSTOMER, useCart } from './CartContext'
import type { Product } from '@/features/catalog/useProducts'

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}

const product = { id: 'p1' } as Product

describe('useCart', () => {
  it('lanza si se usa fuera de <CartProvider>', () => {
    expect(() => renderHook(() => useCart())).toThrow('useCart debe usarse dentro de <CartProvider>')
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
