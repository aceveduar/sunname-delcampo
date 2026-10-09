import { expect, it, vi } from 'vitest'
import type { Product } from '@/features/catalog/useProducts'
import { createHeldSale } from './heldSales'
import { prepareHeldSale } from './reviewHeldSale'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
const unit = {
  id: 'unit',
  name: 'Frijoles',
  unit_id: 'pza',
  price: 20,
  price_per_100g: null,
  sold_by_weight: false,
  active: true,
  track_inventory: true,
} as Product
const weight = {
  ...unit,
  id: 'weight',
  name: 'Mole',
  unit_id: 'kg',
  price: 100,
  price_per_100g: 12,
  sold_by_weight: true,
}

it('actualiza tarifas y peso por monto, conserva pesadas separadas y calcula existencia conjunta', () => {
  const sale = createHeldSale(
    [
      { product: unit, quantity: 2 },
      { product: weight, quantity: 0.2, amountMxn: 25 },
      { product: weight, quantity: 0.2 },
    ],
    'session',
    'customer',
    'Ana',
    '',
  )
  const review = prepareHeldSale(
    sale,
    [
      { ...unit, price: 22 },
      { ...weight, price: 200, price_per_100g: 25 },
    ],
    [
      { product_id: 'unit', quantity_on_hand: 10 },
      { product_id: 'weight', quantity_on_hand: 0.25 },
    ],
    { id: 'customer', name: 'Ana', active: true },
  )
  expect(review.cart).toHaveLength(3)
  expect(review.cart[1].quantity).toBe(0.1)
  expect(review.cart[1].amountMxn).toBe(25)
  expect(review.cart[2].quantity).toBe(0.2)
  expect(review.total).toBe(119)
  expect(review.customerId).toBe('customer')
  expect(
    review.warnings.some((message) =>
      message.includes('Mole: existencia insuficiente'),
    ),
  ).toBe(true)
})
it('avisa antes de omitir inactivos o cambios de unidad y retirar un cliente inactivo', () => {
  const sale = createHeldSale(
    [
      { product: unit, quantity: 1 },
      { product: weight, quantity: 0.1 },
    ],
    'session',
    'customer',
    'Ana',
    '',
  )
  const review = prepareHeldSale(
    sale,
    [
      { ...unit, unit_id: 'box' },
      { ...weight, active: false },
    ],
    [],
    { id: 'customer', name: 'Ana', active: false },
  )
  expect(review.cart).toEqual([])
  expect(review.customerId).toBe('none')
  expect(review.warnings).toHaveLength(3)
})
it('no inventa existencias con un saldo nulo y no revisa stock de productos no controlados', () => {
  const sale = createHeldSale(
    [{ product: unit, quantity: 1 }],
    'session',
    'none',
    null,
    '',
  )
  expect(() =>
    prepareHeldSale(
      sale,
      [unit],
      [{ product_id: 'unit', quantity_on_hand: null }],
      null,
    ),
  ).toThrow()
  expect(
    prepareHeldSale(sale, [{ ...unit, track_inventory: false }], [], null)
      .warnings,
  ).toEqual([])
})
