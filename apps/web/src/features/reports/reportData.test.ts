import { beforeEach, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { loadSalesReport } from './loadSalesReport'
import { loadSales, type SalesQuery } from './useSales'
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
type Row = Record<string, unknown>
let tables: Record<string, Row[]>
let fail: string | null
const reads: {
  table: string
  from: number
  ids?: string[]
  orders: string[]
}[] = []
class Query {
  predicates: ((row: Row) => boolean)[] = []
  orders: { field: string; ascending: boolean }[] = []
  ids?: string[]
  table: string
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value)
    return this
  }
  gte(field: string, value: string) {
    this.predicates.push((row) => String(row[field]) >= value)
    return this
  }
  lte(field: string, value: string) {
    this.predicates.push((row) => String(row[field]) <= value)
    return this
  }
  lt(field: string, value: string) {
    this.predicates.push((row) => String(row[field]) < value)
    return this
  }
  in(field: string, ids: string[]) {
    this.ids = ids
    this.predicates.push((row) => ids.includes(String(row[field])))
    return this
  }
  order(field: string, options?: { ascending: boolean }) {
    this.orders.push({ field, ascending: options?.ascending ?? true })
    return this
  }
  async range(from: number, to: number) {
    reads.push({
      table: this.table,
      from,
      ids: this.ids,
      orders: this.orders.map((o) => o.field),
    })
    if (this.table === fail && from >= 500)
      return { data: null, count: null, error: new Error('Página incompleta') }
    const rows = tables[this.table].filter((row) =>
      this.predicates.every((predicate) => predicate(row)),
    )
    rows.sort((a, b) => {
      for (const order of this.orders) {
        const comparison = String(a[order.field]).localeCompare(
          String(b[order.field]),
        )
        if (comparison) return order.ascending ? comparison : -comparison
      }
      return 0
    })
    return { data: rows.slice(from, to + 1), count: rows.length, error: null }
  }
}
const id = (n: number) =>
  n.toString(16).padStart(8, '0') + '-0000-4000-8000-000000000000'
const range = { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' }
beforeEach(() => {
  fail = null
  reads.length = 0
  tables = {
    sales: [],
    sale_payments: [],
    sale_items: [],
    cash_sessions: [],
    cash_session_balances: [],
  }
  for (let i = 0; i < 601; i++) {
    const lines = i === 0 ? 550 : 1
    tables.sales.push({
      id: id(i),
      status: 'completed',
      created_at: '2026-10-01T12:00:00Z',
      total: lines / 100,
      sold_by: { full_name: 'María' },
    })
    for (let j = 0; j < lines; j++) {
      const common = {
        id: id(i) + '-' + j.toString().padStart(3, '0'),
        sale_id: id(i),
      }
      tables.sale_payments.push({
        ...common,
        amount: 0.01,
        payment_method_id: 'cash',
        payment_method: { name: 'Efectivo' },
      })
      tables.sale_items.push({
        ...common,
        product_id: 'product',
        product_name: 'Producto',
        sold_by_weight: false,
        product: null,
        quantity: 1,
        subtotal: 0.01,
        unit_cost: 0.01,
      })
    }
  }
  tables.sales.push({
    id: id(9999),
    status: 'voided',
    total: 500,
    created_at: '2026-10-01T12:00:00Z',
    sold_by: null,
  })
  tables.sales.push({
    id: id(10000),
    status: 'completed',
    total: 999,
    created_at: range.to,
    sold_by: null,
  })
  for (let i = 0; i < 501; i++) {
    tables.cash_sessions.push({
      id: id(i),
      status: 'closed',
      opened_at: range.from,
      closed_at: '2026-10-01T18:00:00Z',
      opening_amount: 5,
      closing_amount: 10,
      notes: null,
      opened_by: { full_name: 'María' },
    })
    tables.cash_session_balances.push({
      id: id(i),
      cash_sales: 5,
      cash_in: 0,
      cash_out: 0,
      expected_amount: 10,
    })
  }
  vi.mocked(supabase.from).mockImplementation(
    ((table: string) => new Query(table)) as unknown as typeof supabase.from,
  )
})
it('carga todas las páginas de ventas, líneas, pagos y cortes sin listas de UUID excesivas', async () => {
  const report = await loadSalesReport(range)
  expect(report.saleCount).toBe(601)
  expect(report.totalAmount).toBe(11.5)
  expect(report.totalCost).toBe(11.5)
  expect(report.byPaymentMethod[0].amount).toBe(11.5)
  expect(report.topProducts[0].quantity).toBe(1150)
  expect(report.cashSessions).toHaveLength(501)
  for (const table of [
    'sales',
    'sale_payments',
    'sale_items',
    'cash_sessions',
  ]) {
    expect(
      reads.some((read) => read.table === table && read.from === 500),
    ).toBe(true)
  }
  expect(
    reads.filter((read) => read.ids).every((read) => read.ids!.length <= 100),
  ).toBe(true)
  expect(reads.every((read) => read.orders.includes('id'))).toBe(true)
})
it('rechaza el resumen completo si falla una página posterior', async () => {
  fail = 'sale_items'
  await expect(loadSalesReport(range)).rejects.toThrow('Página incompleta')
})
it('no inventa un saldo para un corte sin balance', async () => {
  tables.cash_session_balances.pop()
  await expect(loadSalesReport(range)).rejects.toThrow(
    'No se pudo calcular el corte completo',
  )
})
const query = (extra: Partial<SalesQuery> = {}): SalesQuery => ({
  ...range,
  page: 1,
  status: 'all',
  folio: '',
  revision: 0,
  ...extra,
})
it('pagina el historial más allá de 50 ventas en orden estable y filtra estados', async () => {
  const first = await loadSales(query({ status: 'completed' }))
  const third = await loadSales(query({ status: 'completed', page: 3 }))
  expect(first.count).toBe(601)
  expect(third.sales).toHaveLength(25)
  expect(third.page).toBe(3)
  expect(
    third.sales.some((sale) =>
      first.sales.some((other) => other.id === sale.id),
    ),
  ).toBe(false)
  const voided = await loadSales(query({ status: 'voided' }))
  expect(voided.sales).toHaveLength(1)
  expect(voided.sales[0].status).toBe('voided')
})
it('busca el folio y corrige una página que ya no existe después de filtrar o anular', async () => {
  const result = await loadSales(query({ folio: id(255).slice(0, 8), page: 9 }))
  expect(result.page).toBe(1)
  expect(result.count).toBe(1)
  expect(result.sales[0].id).toBe(id(255))
  const empty = await loadSales(query({ folio: 'ffffffff', page: 3 }))
  expect(empty.sales).toEqual([])
  expect(empty.page).toBe(1)
})
