import { expect, it } from 'vitest'
import { collectPriceEdits, priceError } from './priceEdits'
import type { Product } from './useProducts'

const products = [
  {
    id: 'a',
    name: 'Arroz',
    price: 20,
    sold_by_weight: true,
    price_per_100g: 3,
  },
  {
    id: 'b',
    name: 'Bolsa',
    price: 5,
    sold_by_weight: false,
    price_per_100g: null,
  },
] as Product[]

it('rechaza vacío, negativos y fracciones de centavo sin tratarlos como precios anteriores', () => {
  for (const value of ['', ' ', '-1', '2.001', 'Infinity', '10000000000'])
    expect(priceError(value)).not.toBeNull()
  expect(priceError('0')).toBeNull()
  expect(priceError('12.25')).toBeNull()
  const result = collectPriceEdits(products, {
    a: { price: '' },
    b: { price: '8' },
  })
  expect(result.errors.map((error) => error.id)).toEqual(['a'])
  expect(result.changes).toEqual([{ id: 'b', price: 8, price_per_100g: null }])
})
it('solo incluye cambios reales y conserva el precio por kilo al cambiar 100 g', () => {
  expect(
    collectPriceEdits(products, {
      a: { price: '20.00', price_per_100g: '4' },
      b: { price: '5' },
    }).changes,
  ).toEqual([{ id: 'a', price: 20, price_per_100g: 4 }])
  expect(
    collectPriceEdits(products, { missing: { price: '1' } }).errors,
  ).toHaveLength(1)
})
