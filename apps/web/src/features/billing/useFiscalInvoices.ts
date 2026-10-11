import { useCallback } from 'react'
import { useAsyncResource } from '@/lib/useAsyncResource'
import {
  loadBillableSessions,
  type BillingQuery,
  type BillingResult,
} from './billingData'

export function useFiscalInvoices(query: BillingQuery) {
  const fetcher = useCallback(
    async () => ({ data: await loadBillableSessions(query), error: null }),
    [query],
  )
  return useAsyncResource<BillingResult | null>(
    fetcher,
    'No se pudieron cargar los cortes de caja',
    null,
  )
}
