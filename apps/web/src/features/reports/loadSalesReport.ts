import { readAllPages } from '@/lib/readAllPages'
import { supabase } from '@/lib/supabase'
import { aggregateSalesReport } from './reportAggregation'
import type { CashSessionRow, ReportRange, SalesReport } from './reportTypes'

/** Keeps UUID filters below URL limits; each batch still reads every result page. */
async function readForIds<T>(
  ids: string[],
  read: (batch: string[]) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    result.push(...(await read(ids.slice(offset, offset + 100))))
  }
  return result
}

export async function loadSalesReport(
  range: ReportRange,
): Promise<SalesReport> {
  const sales = await readAllPages((from, to) =>
    supabase
      .from('sales')
      .select('id, total, created_at', { count: 'exact' })
      .eq('status', 'completed')
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  const ids = sales.map((sale) => sale.id)
  const [payments, items, sessions] = await Promise.all([
    readForIds(ids, (batch) =>
      readAllPages((from, to) =>
        supabase
          .from('sale_payments')
          .select(
            'id, payment_method_id, amount, payment_method:payment_methods(name)',
            { count: 'exact' },
          )
          .in('sale_id', batch)
          .order('id')
          .range(from, to),
      ),
    ),
    readForIds(ids, (batch) =>
      readAllPages((from, to) =>
        supabase
          .from('sale_items')
          .select(
            'id, quantity, subtotal, unit_cost, product_id, product_name, sold_by_weight, product:products(name, sold_by_weight, unit:units_of_measure(code))',
            { count: 'exact' },
          )
          .in('sale_id', batch)
          .order('id')
          .range(from, to),
      ),
    ),
    readAllPages((from, to) =>
      supabase
        .from('cash_sessions')
        .select(
          'id, opened_at, closed_at, opening_amount, closing_amount, notes, opened_by:profiles!cash_sessions_opened_by_fkey(full_name)',
          { count: 'exact' },
        )
        .eq('status', 'closed')
        .gte('closed_at', range.from)
        .lt('closed_at', range.to)
        .order('closed_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
  ])
  const balances = await readForIds(
    sessions.map((session) => session.id),
    (batch) =>
      readAllPages((from, to) =>
        supabase
          .from('cash_session_balances')
          .select('id, cash_sales, cash_in, cash_out, expected_amount', {
            count: 'exact',
          })
          .in('id', batch)
          .order('id')
          .range(from, to),
      ),
  )
  const bySession = new Map(balances.map((balance) => [balance.id, balance]))
  const cashSessions: CashSessionRow[] = sessions.map((session) => {
    const balance = bySession.get(session.id)
    if (
      !balance ||
      balance.expected_amount === null ||
      balance.cash_sales === null ||
      balance.cash_in === null ||
      balance.cash_out === null ||
      session.closing_amount === null ||
      !session.closed_at
    ) {
      throw new Error('No se pudo calcular el corte completo')
    }
    return {
      id: session.id,
      openedBy: session.opened_by?.full_name ?? '—',
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      openingAmount: session.opening_amount,
      closingAmount: session.closing_amount,
      cashSales: balance.cash_sales,
      cashIn: balance.cash_in,
      cashOut: balance.cash_out,
      expectedClosing: balance.expected_amount,
      notes: session.notes,
      difference:
        (Math.round(session.closing_amount * 100) -
          Math.round(balance.expected_amount * 100)) /
        100,
    }
  })
  return {
    ...range,
    ...aggregateSalesReport(sales, payments, items, range),
    cashSessions,
  }
}
