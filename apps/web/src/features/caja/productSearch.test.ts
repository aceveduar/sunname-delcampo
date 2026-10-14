import { describe, expect, it } from 'vitest'
import type { Product } from '@/features/catalog/useProducts'
import { createProductSearch, searchProducts } from './productSearch'

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

it('conserva prioridad SKU/nombre/parcial y orden estable sin modificar el catálogo', () => {
  const catalog = [
    { ...products[0], id: 'partial', name: 'Café especial', sku: null },
    { ...products[0], id: 'name', name: 'Café', sku: null },
    { ...products[0], id: 'sku1', name: 'Otro', sku: 'CAFE' },
    { ...products[0], id: 'sku2', name: 'Otro más', sku: 'cafe' },
    { ...products[0], id: 'partial2', name: 'Café tostado', sku: null },
  ]
  const search = createProductSearch(catalog)
  expect(search(' café ', 'all').map((p) => p.id)).toEqual([
    'sku1',
    'sku2',
    'name',
    'partial',
    'partial2',
  ])
  expect(search('', 'all')).toEqual([])
  expect(search('', 'c1')).toEqual(catalog)
  expect(catalog[0].id).toBe('partial')
  expect(search('inexistente', 'all')).toEqual([])
})

it('reconstruye el índice con disponibilidad, nombre y precio del catálogo actualizado', () => {
  const original = { ...products[0], price: 10 }
  const oldSearch = createProductSearch([original])
  const replacement = { ...original, name: 'Té', sku: 'TE', price: 20 }
  const newSearch = createProductSearch([replacement])
  expect(oldSearch('cafe', 'all')[0]).toBe(original)
  expect(newSearch('cafe', 'all')).toEqual([])
  expect(newSearch('te', 'all')[0]).toBe(replacement)
  expect(
    createProductSearch([{ ...replacement, active: false }])('te', 'all'),
  ).toEqual([])
})
