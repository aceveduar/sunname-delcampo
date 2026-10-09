import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDraft, draftKey } from './cartDraft'
import { CartProvider, useCart } from './CartContext'
import { readCartDraft, readHeldSales } from './heldSaleStorage'
import { heldSalesKey } from './heldSales'
import type { Product } from '@/features/catalog/useProducts'
const product = {
  id: 'p',
  name: 'Frijoles',
  unit_id: 'pza',
  price: 20,
  price_per_100g: null,
  sold_by_weight: false,
  active: true,
} as Product
const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: async (_key: string, action: () => unknown) => action() },
  })
})
afterEach(() => {
  cleanup()
  if (locks) Object.defineProperty(navigator, 'locks', locks)
  else Reflect.deleteProperty(navigator, 'locks')
})
function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider userId="user">{children}</CartProvider>
}

it('conserva el respaldo si no puede leerlo y permite recuperar cliente y productos después de reintentar', () => {
  const key = draftKey('user')
  const saved = JSON.stringify(
    createDraft([{ product, quantity: 2 }], 'session', null, 'customer'),
  )
  sessionStorage.setItem(key, saved)
  const read = Storage.prototype.getItem
  const failingRead = vi
    .spyOn(Storage.prototype, 'getItem')
    .mockImplementation(function (this: Storage, storageKey) {
      if (this === sessionStorage)
        throw new Error('Lectura temporalmente bloqueada')
      return read.call(this, storageKey)
    })
  const { result } = renderHook(useCart, { wrapper })
  act(() => result.current.syncCashSession('session'))
  expect(result.current.draftReadError).toBe(true)
  failingRead.mockRestore()
  expect(sessionStorage.getItem(key)).toBe(saved)
  act(() => result.current.retryDraftRead())
  expect(result.current.pendingDraft?.customerId).toBe('customer')
  act(() => result.current.recoverDraft([product], 'customer'))
  expect(result.current.cart[0].quantity).toBe(2)
  expect(result.current.customerId).toBe('customer')
  expect(result.current.cashReceived).toBe('')
})
function prepare(cart: ReturnType<typeof useCart>) {
  cart.syncCashSession('session')
  cart.setCart([{ product, quantity: 2 }])
  cart.setCustomerId('customer')
  cart.setCashReceived('100')
  cart.setPaymentMethodId('cash')
}
it('pausa, atiende otra venta y retoma conservando cliente pero sin efectivo ni pago', async () => {
  const { result } = renderHook(useCart, { wrapper })
  act(() => prepare(result.current))
  await act(async () => {
    await result.current.holdSale('Bolsa azul', 'Ana')
  })
  expect(result.current.cart).toEqual([])
  expect(result.current.cashReceived).toBe('')
  expect(result.current.customerId).toBe('none')
  expect(result.current.heldSales).toHaveLength(1)
  const held = result.current.heldSales[0]
  const review = {
    cart: [{ product, quantity: 2 }],
    customerId: 'customer',
    customerName: 'Ana',
    warnings: [],
    total: 40,
  }
  act(() => result.current.setCart([{ product, quantity: 1 }]))
  await act(async () => {
    await expect(
      result.current.resumeSale(held.id, review, 'session'),
    ).rejects.toThrow('venta actual')
  })
  expect(result.current.cart[0].quantity).toBe(1)
  expect(readHeldSales('user').sales).toHaveLength(1)
  act(() => result.current.resetSale())
  await act(async () => {
    await result.current.resumeSale(held.id, review, 'session')
  })
  expect(result.current.cart[0].quantity).toBe(2)
  expect(result.current.customerId).toBe('customer')
  expect(result.current.cashReceived).toBe('')
  expect(result.current.paymentMethodId).toBe('')
  expect(readCartDraft('user')?.customerId).toBe('customer')
  expect(result.current.heldSales).toEqual([])
})
it('no permite pausar un intento de cobro ni borrar el carrito con almacenamiento ilegible', async () => {
  const { result } = renderHook(useCart, { wrapper })
  act(() => prepare(result.current))
  act(() => {
    result.current.beginCheckout()
    result.current.holdForVerification()
  })
  await act(async () => {
    await expect(result.current.holdSale('', 'Ana')).rejects.toThrow(
      'verificar',
    )
  })
  expect(result.current.pendingDraft?.checkoutId).toBeTruthy()
  act(() => {
    result.current.recoverDraft([product])
  })
  await act(async () => {
    await expect(result.current.holdSale('', 'Ana')).rejects.toThrow(
      'verificar',
    )
  })
  expect(result.current.cart).toHaveLength(1)
  act(() => {
    result.current.resetSale()
    prepare(result.current)
  })
  localStorage.setItem(heldSalesKey('user'), '{broken')
  await act(async () => {
    await expect(result.current.holdSale('', 'Ana')).rejects.toThrow()
  })
  expect(result.current.cart).toHaveLength(1)
  expect(result.current.customerId).toBe('customer')
})
