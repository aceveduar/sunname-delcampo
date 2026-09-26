import { expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { storedSaleReceipt } from './saleReceipt'
it('reimprime importes almacenados sin recalcular ni inventar efectivo o cambio', () => {
  const receipt = storedSaleReceipt({
    id: 'sale',
    created_at: '2026-09-25',
    total: 50,
    status: 'voided',
    customer: { name: 'Cliente' },
    sale_items: [
      {
        product_name: 'Nombre al vender',
        sold_by_weight: true,
        quantity: 0.313,
        unit_price: 159.74,
        subtotal: 50,
      },
    ],
    sale_payments: [{ amount: 50, method: { name: 'Efectivo' } }],
  })
  expect(receipt.lines).toEqual([
    { name: 'Nombre al vender', detail: '313 g', total: 50 },
  ])
  expect(receipt.total).toBe(50)
  expect(receipt.status).toBe('voided')
  expect(receipt.cashReceived).toBeNull()
  expect(receipt.change).toBeNull()
})
