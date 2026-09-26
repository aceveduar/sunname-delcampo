import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider, useCart } from './CartContext'
import { useSubmitSale } from './useSubmitSale'
import type { Product } from '@/features/catalog/useProducts'
import type { PaymentMethod } from './usePaymentMethods'
import { draftKey, parseDraft } from './cartDraft'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

beforeEach(() => {
  sessionStorage.clear()
  rpc.mockReset()
})
afterEach(cleanup)
const product = {
  id: 'p1',
  name: 'Prueba',
  active: true,
  price: 30,
  price_per_100g: null,
  sold_by_weight: false,
} as Product
const methods = [
  { id: 'cash', code: 'cash', name: 'Efectivo' },
] as PaymentMethod[]
function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider userId="test-user">{children}</CartProvider>
}
function useSale() {
  return {
    cart: useCart(),
    sale: useSubmitSale({
      cashSessionId: 'session',
      paymentMethods: methods,
      customers: [],
      catalogReady: true,
    }),
  }
}
function prepare(cart: ReturnType<typeof useCart>) {
  cart.syncCashSession('session')
  cart.setCart([{ product, quantity: 1 }])
  cart.setPaymentMethodId('cash')
  cart.setCashReceived('50')
}

describe('Cobro y borrador', () => {
  it('bloquea envíos simultáneos y limpia el borrador solo tras confirmar', async () => {
    let finish!: (value: { data: string; error: null }) => void
    rpc.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { result } = renderHook(useSale, { wrapper })
    act(() => {
      prepare(result.current.cart)
    })
    let first!: Promise<void>
    act(() => {
      first = result.current.sale.handleCheckout()
      void result.current.sale.handleCheckout()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(
      parseDraft(sessionStorage.getItem(draftKey('test-user')))?.checkoutId,
    ).toBeTruthy()
    await act(async () => {
      finish({ data: 'sale-1', error: null })
      await first
    })
    expect(result.current.cart.cart).toEqual([])
    expect(sessionStorage.getItem(draftKey('test-user'))).toBeNull()
    expect(result.current.sale.receipt?.saleId).toBe('sale-1')
  })

  it('conserva el carrito y exige verificar un resultado de cobro incierto', async () => {
    rpc.mockRejectedValueOnce(new Error('Conexión interrumpida'))
    const { result } = renderHook(useSale, { wrapper })
    act(() => {
      prepare(result.current.cart)
    })
    await act(async () => {
      await result.current.sale.handleCheckout()
    })
    expect(result.current.cart.cart).toHaveLength(1)
    expect(result.current.cart.pendingDraft?.checkoutId).toBeTruthy()
    expect(result.current.sale.checkoutDisabled).toBe(true)
    expect(result.current.sale.submitting).toBe(false)
    await act(async () => {
      await result.current.sale.handleCheckout()
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

it('no envía cobros cuando el navegador está sin conexión', async () => {
  const status = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  try {
    const { result } = renderHook(useSale, { wrapper })
    act(() => prepare(result.current.cart))
    await act(async () => {
      await result.current.sale.handleCheckout()
    })
    expect(result.current.sale.checkoutDisabled).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
    expect(result.current.cart.cart).toHaveLength(1)
  } finally {
    status.mockRestore()
  }
})
