import { expect, it } from 'vitest'
import {
  aggregateSalesReport,
  dailySales,
  type ReportItem,
} from './reportAggregation'

const range = {
  from: new Date(2026, 9, 1).toISOString(),
  to: new Date(2026, 9, 4).toISOString(),
}
const item = (values: Partial<ReportItem>): ReportItem => ({
  product_id: 'a',
  product_name: 'Nombre guardado',
  sold_by_weight: false,
  quantity: 1,
  subtotal: 1,
  unit_cost: 0.1,
  product: {
    name: 'Mismo nombre',
    sold_by_weight: false,
    unit: { code: 'PZA' },
  },
  ...values,
})
it('suma centavos, separa productos con el mismo nombre y ordena por importe, no por kilos o piezas', () => {
  const result = aggregateSalesReport(
    [
      {
        id: 'a',
        total: 0.1,
        created_at: new Date(2026, 9, 1, 12).toISOString(),
      },
      {
        id: 'b',
        total: 0.2,
        created_at: new Date(2026, 9, 1, 13).toISOString(),
      },
    ],
    [
      {
        payment_method_id: 'cash',
        amount: 0.1,
        payment_method: { name: 'Efectivo' },
      },
      {
        payment_method_id: 'cash',
        amount: 0.2,
        payment_method: { name: 'Efectivo' },
      },
    ],
    [
      item({ quantity: 100, subtotal: 100 }),
      item({
        product_id: 'b',
        sold_by_weight: true,
        quantity: 0.5,
        subtotal: 200,
        unit_cost: 172,
      }),
    ],
    range,
  )
  expect(result.totalAmount).toBe(0.3)
  expect(result.byPaymentMethod[0].amount).toBe(0.3)
  expect(result.topProducts).toHaveLength(2)
  expect(result.topProducts[0]).toMatchObject({
    quantity: 0.5,
    unit: 'KG',
    amount: 200,
  })
  expect(result.topProducts[1]).toMatchObject({
    quantity: 100,
    unit: 'PZA',
    amount: 100,
  })
  expect(result.totalCost).toBe(96)
})
it('conserva gramos exactos, usa el nombre guardado si falta el catálogo y detecta costos desconocidos', () => {
  const result = aggregateSalesReport(
    [],
    [],
    [
      item({
        product: null,
        quantity: 0.1,
        subtotal: 0.1,
        sold_by_weight: true,
        unit_cost: null,
      }),
      item({
        product: null,
        quantity: 0.2,
        subtotal: 0.2,
        sold_by_weight: true,
        unit_cost: 0,
      }),
    ],
    range,
  )
  expect(result.topProducts[0]).toMatchObject({
    name: 'Nombre guardado',
    quantity: 0.3,
    amount: 0.3,
    unit: 'KG',
  })
  expect(result.missingCostCount).toBe(1)
})
it('incluye días sin ventas, respeta la medianoche local y el límite final exclusivo', () => {
  const days = dailySales(
    [
      {
        id: 'a',
        total: 10,
        created_at: new Date(2026, 9, 1, 23, 59).toISOString(),
      },
      {
        id: 'b',
        total: 20,
        created_at: new Date(2026, 9, 2, 0, 1).toISOString(),
      },
    ],
    range,
  )
  expect(days).toEqual([
    { date: '2026-10-01', amount: 10, count: 1 },
    { date: '2026-10-02', amount: 20, count: 1 },
    { date: '2026-10-03', amount: 0, count: 0 },
  ])
})
it('separa modalidades de venta aunque el producto haya cambiado su unidad en el catálogo', () => {
  const product = {
    name: 'Producto',
    sold_by_weight: true,
    unit: { code: 'KG' },
  }
  const result = aggregateSalesReport(
    [],
    [],
    [
      item({ product, sold_by_weight: true, quantity: 0.2 }),
      item({ product, sold_by_weight: false, quantity: 1 }),
    ],
    range,
  )
  expect(result.topProducts).toHaveLength(2)
  expect(result.topProducts.map((row) => row.quantity).sort()).toEqual([0.2, 1])
})
