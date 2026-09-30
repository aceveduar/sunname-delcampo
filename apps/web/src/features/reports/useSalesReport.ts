import { useCallback } from 'react'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { supabase } from '../../lib/supabase'

type PaymentBreakdown = { name: string; amount: number }
type TopProduct = { name: string; quantity: number; amount: number }
export type CashSessionRow = {
  id: string
  openedBy: string
  openedAt: string
  closedAt: string
  openingAmount: number
  closingAmount: number
  cashSales: number
  cashIn: number
  cashOut: number
  expectedClosing: number
  notes: string | null
  difference: number
}

export function useSalesReport(from: string, to: string) {
  const load = useCallback(async () => {
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id, total')
      .eq('status', 'completed')
      .gte('created_at', from)
      .lt('created_at', to)

    if (salesError) return { data: null, error: salesError }

    const saleIds = (sales ?? []).map((s) => s.id)
    const total = (sales ?? []).reduce((sum, s) => sum + s.total, 0)

    let payments: PaymentBreakdown[] = []
    let products: TopProduct[] = []
    let cost = 0

    if (saleIds.length > 0) {
      const [
        { data: paymentRows, error: paymentsError },
        { data: itemRows, error: itemsError },
      ] = await Promise.all([
        supabase
          .from('sale_payments')
          .select('amount, payment_method:payment_methods(name)')
          .in('sale_id', saleIds),
        supabase
          .from('sale_items')
          .select(
            'quantity, subtotal, unit_cost, product_id, product:products(name)',
          )
          .in('sale_id', saleIds),
      ])

      if (paymentsError || itemsError)
        return { data: null, error: paymentsError ?? itemsError }
      const paymentMap = new Map<string, number>()
      for (const row of paymentRows ?? []) {
        const name = row.payment_method?.name ?? 'Otro'
        paymentMap.set(name, (paymentMap.get(name) ?? 0) + row.amount)
      }
      payments = [...paymentMap.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)

      const productMap = new Map<string, TopProduct>()
      for (const row of itemRows ?? []) {
        const name = row.product?.name ?? 'Producto eliminado'
        const entry = productMap.get(name) ?? { name, quantity: 0, amount: 0 }
        entry.quantity += row.quantity
        entry.amount += row.subtotal
        productMap.set(name, entry)
      }
      products = [...productMap.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10)

      // El costo queda congelado en cada renglón al momento de la venta
      // (sale_items.unit_cost) -- así el margen de un periodo ya
      // cerrado no cambia solo porque el costo de hoy sea distinto.
      cost = (itemRows ?? []).reduce(
        (sum, r) => sum + r.quantity * (r.unit_cost ?? 0),
        0,
      )
    }

    const { data: sessions, error: sessionsError } = await supabase
      .from('cash_sessions')
      .select(
        'id, opened_at, closed_at, opening_amount, closing_amount, notes, opened_by:profiles!cash_sessions_opened_by_fkey(full_name)',
      )
      .eq('status', 'closed')
      .gte('closed_at', from)
      .lt('closed_at', to)
      .order('closed_at', { ascending: false })

    if (sessionsError) return { data: null, error: sessionsError }
    let sessionRows: CashSessionRow[] = []
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s) => s.id)

      const { data: balances, error: balanceError } = await supabase
        .from('cash_session_balances')
        .select('id, cash_sales, cash_in, cash_out, expected_amount')
        .in('id', sessionIds)
      if (balanceError) return { data: null, error: balanceError }
      const bySession = new Map(
        (balances ?? []).map((balance) => [balance.id, balance]),
      )

      sessionRows = sessions.map((session) => {
        const balance = bySession.get(session.id)
        if (
          !balance ||
          balance.expected_amount === null ||
          balance.cash_sales === null ||
          balance.cash_in === null ||
          balance.cash_out === null
        )
          throw new Error('No se pudo calcular el corte completo')
        const cashSales = balance.cash_sales
        const expectedClosing = balance.expected_amount
        const closingAmount = session.closing_amount ?? 0
        return {
          id: session.id,
          openedBy: session.opened_by?.full_name ?? '—',
          openedAt: session.opened_at,
          closedAt: session.closed_at ?? session.opened_at,
          openingAmount: session.opening_amount,
          closingAmount,
          cashSales,
          cashIn: balance.cash_in,
          cashOut: balance.cash_out,
          expectedClosing,
          notes: session.notes,
          difference: Math.round((closingAmount - expectedClosing) * 100) / 100,
        }
      })
    }

    return {
      data: {
        totalAmount: total,
        totalCost: cost,
        saleCount: sales?.length ?? 0,
        byPaymentMethod: payments,
        topProducts: products,
        cashSessions: sessionRows,
        from,
        to,
      },
      error: null,
    }
  }, [from, to])
  const { data, ...state } = useAsyncResource(
    load,
    'No se pudo cargar el reporte completo',
    {
      totalAmount: 0,
      totalCost: 0,
      saleCount: 0,
      byPaymentMethod: [] as PaymentBreakdown[],
      topProducts: [] as TopProduct[],
      cashSessions: [] as CashSessionRow[],
      from: '',
      to: '',
    },
  )
  const margin = data.totalAmount - data.totalCost
  return {
    ...data,
    ...state,
    margin,
    marginPercent: data.totalAmount ? (margin / data.totalAmount) * 100 : 0,
    avgTicket: data.saleCount ? data.totalAmount / data.saleCount : 0,
  }
}
