import { useCallback } from 'react'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { loadSalesReport } from './loadSalesReport'
import type { SalesReport } from './reportTypes'
export type { CashSessionRow } from './reportTypes'

export function useSalesReport(from: string, to: string) {
  const load = useCallback(
    async () => ({ data: await loadSalesReport({ from, to }), error: null }),
    [from, to],
  )
  const { data, ...state } = useAsyncResource<SalesReport>(
    load,
    'No se pudo cargar el reporte completo',
    {
      totalAmount: 0,
      totalCost: 0,
      missingCostCount: 0,
      saleCount: 0,
      byPaymentMethod: [],
      topProducts: [],
      dailySales: [],
      cashSessions: [],
      from: '',
      to: '',
    },
  )
  const margin =
    (Math.round(data.totalAmount * 100) - Math.round(data.totalCost * 100)) /
    100
  return {
    ...data,
    ...state,
    margin,
    marginPercent: data.totalAmount ? (margin / data.totalAmount) * 100 : 0,
    avgTicket: data.saleCount ? data.totalAmount / data.saleCount : 0,
  }
}
