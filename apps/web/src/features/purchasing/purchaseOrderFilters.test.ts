import { expect, it } from 'vitest'
import {
  filterPurchaseOrders,
  purchaseFilter,
  purchaseStatusCounts,
} from './purchaseOrderFilters'
import { deliveryQuantityError } from './deliveryQuantityError'
import type { PurchaseOrder } from './usePurchaseOrders'

const order = (id: string, status: PurchaseOrder['status'], received = 0) =>
  ({
    id,
    status,
    supplier: { name: 'José de la Región' },
    purchase_order_items: [
      { id: id + '-item', quantity: 10, received_quantity: received },
    ],
  }) as PurchaseOrder
const orders = [
  order('folio-a', 'ordered'),
  order('folio-b', 'ordered', 3),
  order('folio-c', 'received', 10),
  order('folio-d', 'cancelled'),
]

it('cuenta Por recibir incluyendo parciales, sin confundirlos con órdenes sin entregas', () => {
  expect(purchaseStatusCounts(orders)).toEqual({
    all: 4,
    pending: 2,
    partial: 1,
    received: 1,
    ordered: 1,
    draft: 0,
    cancelled: 1,
  })
  expect(filterPurchaseOrders(orders, 'pending', '').map((o) => o.id)).toEqual([
    'folio-a',
    'folio-b',
  ])
})
it('busca palabras del proveedor y folio sin acentos y tolera estados de URL desconocidos', () => {
  expect(
    filterPurchaseOrders(orders, 'all', 'region jose folio-b').map((o) => o.id),
  ).toEqual(['folio-b'])
  expect(purchaseFilter('unknown')).toBe('all')
})
it('explica cantidades inválidas, exceso y precisión sin rechazar milésimas válidas', () => {
  expect(deliveryQuantityError('8', 7, 'KG')).toContain('7 KG')
  expect(deliveryQuantityError('1.0001', 7, 'KG')).toContain('tres decimales')
  expect(deliveryQuantityError('-1', 7, 'KG')).toContain('positiva')
  expect(deliveryQuantityError('NaN', 7, 'KG')).toContain('positiva')
  expect(deliveryQuantityError('0.001', 0.001, 'KG')).toBeNull()
  expect(deliveryQuantityError('', 7, 'KG')).toBeNull()
})
