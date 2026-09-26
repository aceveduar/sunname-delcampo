import { describe, expect, it } from 'vitest'
import type { Product } from '@/features/catalog/useProducts'
import { searchProducts } from './productSearch'

const products = Array.from(
  { length: 30 },
  (_, i) =>
    ({
      id: String(i),
      name: `Café ${i}`,
      sku: `SKU-${i}`,
      active: true,
      category_id: 'c1',
    }) as Product,
)
describe('Búsqueda de caja', () => {
  it('devuelve todas las coincidencias y coloca la exacta antes de las parciales', () => {
    expect(searchProducts(products, 'cafe', 'all')).toHaveLength(30)
    expect(searchProducts([...products].reverse(), 'cafe 1', 'all')[0].id).toBe(
      '1',
    )
    expect(searchProducts(products, 'sku-25', 'all')[0].id).toBe('25')
  })
  it('respeta categoría y disponibilidad', () => {
    expect(searchProducts(products, '', 'c1')).toHaveLength(30)
    expect(searchProducts(products, 'cafe', 'c2')).toEqual([])
    expect(
      searchProducts([{ ...products[0], active: false }], 'cafe', 'all'),
    ).toEqual([])
  })
})
