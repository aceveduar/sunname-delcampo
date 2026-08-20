import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

type PaymentBreakdown = { name: string; amount: number }
type TopProduct = { name: string; quantity: number; amount: number }
type CashSessionRow = {
  id: string
  openedBy: string
  openedAt: string
  closedAt: string
  openingAmount: number
  closingAmount: number
  cashSales: number
  expectedClosing: number
  difference: number
}

export function useSalesReport(from: string, to: string) {
  const [loading, setLoading] = useState(true)
  const [totalAmount, setTotalAmount] = useState(0)
  const [saleCount, setSaleCount] = useState(0)
  const [byPaymentMethod, setByPaymentMethod] = useState<PaymentBreakdown[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, total')
        .eq('status', 'completed')
        .gte('created_at', from)
        .lte('created_at', to)

      if (salesError) {
        toast.error('No se pudieron cargar las ventas', { description: salesError.message })
        if (!cancelled) setLoading(false)
        return
      }

      const saleIds = (sales ?? []).map((s) => s.id)
      const total = (sales ?? []).reduce((sum, s) => sum + s.total, 0)

      let payments: PaymentBreakdown[] = []
      let products: TopProduct[] = []

      if (saleIds.length > 0) {
        const [{ data: paymentRows }, { data: itemRows }] = await Promise.all([
          supabase
            .from('sale_payments')
            .select('amount, payment_method:payment_methods(name)')
            .in('sale_id', saleIds),
          supabase.from('sale_items').select('quantity, subtotal, product:products(name)').in('sale_id', saleIds),
        ])

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
        products = [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10)
      }

      const { data: sessions } = await supabase
        .from('cash_sessions')
        .select('id, opened_at, closed_at, opening_amount, closing_amount, opened_by:profiles!cash_sessions_opened_by_fkey(full_name)')
        .eq('status', 'closed')
        .gte('closed_at', from)
        .lte('closed_at', to)
        .order('closed_at', { ascending: false })

      let sessionRows: CashSessionRow[] = []
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id)

        const { data: cashMethod } = await supabase
          .from('payment_methods')
          .select('id')
          .eq('code', 'cash')
          .maybeSingle()

        const { data: sessionSales } = await supabase
          .from('sales')
          .select('id, cash_session_id')
          .in('cash_session_id', sessionIds)

        const cashBySession = new Map<string, number>()
        if (cashMethod && sessionSales && sessionSales.length > 0) {
          const saleIdToSession = new Map(sessionSales.map((s) => [s.id, s.cash_session_id]))
          const { data: cashPayments } = await supabase
            .from('sale_payments')
            .select('amount, sale_id')
            .eq('payment_method_id', cashMethod.id)
            .in(
              'sale_id',
              sessionSales.map((s) => s.id),
            )
          for (const payment of cashPayments ?? []) {
            const sessionId = saleIdToSession.get(payment.sale_id)
            if (!sessionId) continue
            cashBySession.set(sessionId, (cashBySession.get(sessionId) ?? 0) + payment.amount)
          }
        }

        sessionRows = sessions.map((session) => {
          const cashSales = cashBySession.get(session.id) ?? 0
          const expectedClosing = session.opening_amount + cashSales
          const closingAmount = session.closing_amount ?? 0
          return {
            id: session.id,
            openedBy: session.opened_by?.full_name ?? '—',
            openedAt: session.opened_at,
            closedAt: session.closed_at ?? session.opened_at,
            openingAmount: session.opening_amount,
            closingAmount,
            cashSales,
            expectedClosing,
            difference: closingAmount - expectedClosing,
          }
        })
      }

      if (cancelled) return
      setTotalAmount(total)
      setSaleCount(sales?.length ?? 0)
      setByPaymentMethod(payments)
      setTopProducts(products)
      setCashSessions(sessionRows)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [from, to])

  return {
    loading,
    totalAmount,
    saleCount,
    avgTicket: saleCount ? totalAmount / saleCount : 0,
    byPaymentMethod,
    topProducts,
    cashSessions,
  }
}
