import { describe, expect, it } from 'vitest'
import type { Product } from '@/features/catalog/useProducts'
import { createDraft, parseDraft, restoreDraft } from './cartDraft'

const product = {
  id: 'p1',
  name: 'Producto',
  active: true,
  sold_by_weight: false,
  price: 30,
  price_per_100g: null,
} as Product

describe('Borrador de venta', () => {
  it('rechaza datos corruptos, versiones desconocidas y cantidades inválidas', () => {
    expect(parseDraft('{')).toBeNull()
    const draft = createDraft([{ product, quantity: 2 }], 'session', null)
    expect(parseDraft(JSON.stringify(draft))).toEqual(draft)
    expect(parseDraft(JSON.stringify({ ...draft, version: 2 }))).toBeNull()
    expect(
      parseDraft(
        JSON.stringify({
          ...draft,
          lines: [{ ...draft.lines[0], quantity: -1 }],
        }),
      ),
    ).toBeNull()
    expect(
      parseDraft(
        JSON.stringify({
          ...draft,
          lines: [{ ...draft.lines[0], quantity: 0.5 }],
        }),
      ),
    ).toBeNull()
  })
  it('recupera precios actuales y excluye productos inactivos o con cambio de unidad', () => {
    const draft = createDraft([{ product, quantity: 2 }], 'session', null)
    const result = restoreDraft(draft, [{ ...product, price: 40 }])
    expect(result.cart[0].product.price).toBe(40)
    expect(result.repriced).toBe(1)
    expect(restoreDraft(draft, [{ ...product, active: false }]).omitted).toBe(1)
    expect(
      restoreDraft(draft, [{ ...product, sold_by_weight: true }]).omitted,
    ).toBe(1)
    expect(restoreDraft(draft, []).cart).toEqual([])
  })
  it('recalcula el peso de ventas por monto sin cambiar el monto solicitado', () => {
    const weighted = {
      ...product,
      sold_by_weight: true,
      price: 100,
      price_per_100g: 10,
    }
    const draft = createDraft(
      [{ product: weighted, quantity: 1, amountMxn: 100 }],
      'session',
      null,
    )
    const result = restoreDraft(draft, [
      { ...weighted, price: 200, price_per_100g: 20 },
    ])
    expect(result.cart[0].quantity).toBe(0.5)
    expect(result.cart[0].amountMxn).toBe(100)
  })
})
