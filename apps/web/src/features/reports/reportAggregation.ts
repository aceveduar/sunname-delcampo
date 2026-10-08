import { localDateValue } from '@/lib/dateRange'
import type {
  DailySales,
  PaymentBreakdown,
  ReportRange,
  TopProduct,
} from './reportTypes'

export type ReportSale = { id: string; total: number; created_at: string }
export type ReportPayment = {
  payment_method_id: string
  amount: number
  payment_method: { name: string } | null
}
export type ReportItem = {
  product_id: string
  product_name: string | null
  sold_by_weight: boolean | null
  quantity: number
  subtotal: number
  unit_cost: number | null
  product: {
    name: string
    sold_by_weight: boolean
    unit: { code: string } | null
  } | null
}

/** Dates follow the same local-day boundaries as the report's date picker. */
export function dailySales(
  sales: ReportSale[],
  range: ReportRange,
): DailySales[] {
  const totals = new Map<string, { cents: number; count: number }>()
  for (const sale of sales) {
    const key = localDateValue(new Date(sale.created_at))
    const day = totals.get(key) ?? { cents: 0, count: 0 }
    day.cents += Math.round(sale.total * 100)
    day.count++
    totals.set(key, day)
  }
  const date = new Date(range.from)
  date.setHours(0, 0, 0, 0)
  const end = new Date(range.to).getTime()
  const days: DailySales[] = []
  while (date.getTime() < end) {
    const key = localDateValue(date)
    const value = totals.get(key)
    days.push({
      date: key,
      amount: (value?.cents ?? 0) / 100,
      count: value?.count ?? 0,
    })
    date.setDate(date.getDate() + 1)
  }
  return days
}

export function aggregateSalesReport(
  sales: ReportSale[],
  payments: ReportPayment[],
  items: ReportItem[],
  range: ReportRange,
) {
  const paymentMap = new Map<string, PaymentBreakdown>()
  for (const row of payments) {
    const entry = paymentMap.get(row.payment_method_id) ?? {
      id: row.payment_method_id,
      name: row.payment_method?.name ?? 'Otro',
      amount: 0,
    }
    entry.amount += Math.round(row.amount * 100)
    paymentMap.set(entry.id, entry)
  }
  const productMap = new Map<string, TopProduct>()
  let costThousandthsOfCent = 0
  let missingCostCount = 0
  for (const row of items) {
    const byWeight = row.sold_by_weight ?? row.product?.sold_by_weight
    const unit = byWeight ? 'KG' : (row.product?.unit?.code ?? 'unidad')
    const id = row.product_id + ':' + (byWeight ? 'weight:' : 'unit:') + unit
    const entry = productMap.get(id) ?? {
      id,
      name: row.product?.name ?? row.product_name ?? 'Producto no disponible',
      quantity: 0,
      unit,
      amount: 0,
    }
    entry.quantity += Math.round(row.quantity * 1000)
    entry.amount += Math.round(row.subtotal * 100)
    productMap.set(id, entry)
    if (row.unit_cost === null) missingCostCount++
    else
      costThousandthsOfCent +=
        Math.round(row.quantity * 1000) * Math.round(row.unit_cost * 100)
  }
  return {
    totalAmount:
      sales.reduce((sum, row) => sum + Math.round(row.total * 100), 0) / 100,
    totalCost: Math.round(costThousandthsOfCent / 1000) / 100,
    missingCostCount,
    saleCount: sales.length,
    byPaymentMethod: [...paymentMap.values()]
      .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
      .map((row) => ({ ...row, amount: row.amount / 100 })),
    topProducts: [...productMap.values()]
      .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
      .slice(0, 10)
      .map((row) => ({
        ...row,
        amount: row.amount / 100,
        quantity: row.quantity / 1000,
      })),
    dailySales: dailySales(sales, range),
  }
}
