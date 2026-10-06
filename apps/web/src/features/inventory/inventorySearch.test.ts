import { expect, it } from 'vitest'
import { searchStockRows } from './inventorySearch'
import type { StockRow } from './useInventoryStock'
const rows = [
  {
    product: { id: 'a', name: 'Café Costeña 105 G', sku: '75001-extra' },
    quantityOnHand: 5,
  },
  {
    product: { id: 'b', name: 'Otro producto', sku: '75001' },
    quantityOnHand: 3,
  },
  {
    product: { id: 'c', name: 'Café Costeña 220 G', sku: 'CAF-220' },
    quantityOnHand: 8,
  },
] as StockRow[]
it('busca palabras sin acentos y prioriza el código exacto sin alterar el catálogo', () => {
  expect(searchStockRows(rows, '105 cafe').map((r) => r.product.id)).toEqual([
    'a',
  ])
  expect(
    searchStockRows(rows, 'costeña CAF-220').map((r) => r.product.id),
  ).toEqual(['c'])
  expect(searchStockRows(rows, '75001').map((r) => r.product.id)).toEqual([
    'b',
    'a',
  ])
  expect(rows.map((r) => r.product.id)).toEqual(['a', 'b', 'c'])
  expect(searchStockRows(rows, 'inexistente')).toEqual([])
})
