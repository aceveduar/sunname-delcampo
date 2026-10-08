import { useCallback } from 'react'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { uuidPrefixRange } from '@/lib/uuidPrefix'
import type { Database } from '@/lib/database.types'
import type { ReportRange } from './reportTypes'

type SaleStatus = Database['public']['Enums']['sale_status']
export type SalesQuery = ReportRange & {
  page: number
  status: 'all' | SaleStatus
  folio: string
  revision: number
}
export type SaleRow = {
  id: string
  createdAt: string
  total: number
  status: SaleStatus
  soldBy: string
}
export const SALES_PAGE_SIZE = 25

export async function loadSales(query: SalesQuery) {
  const { lowerId, upperId } = uuidPrefixRange(query.folio)
  const read = async (page: number) => {
    let request = supabase
      .from('sales')
      .select('id, created_at, total, status, sold_by:profiles(full_name)', {
        count: 'exact',
      })
      .gte('created_at', query.from)
      .lt('created_at', query.to)
    if (query.status !== 'all') request = request.eq('status', query.status)
    if (lowerId && upperId)
      request = request.gte('id', lowerId).lte('id', upperId)
    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * SALES_PAGE_SIZE, page * SALES_PAGE_SIZE - 1)
    if (error) throw error
    if (data === null || count === null)
      throw new Error('Respuesta incompleta del historial')
    return { data, count }
  }
  let page = query.page
  let result = await read(page)
  const lastPage = Math.max(1, Math.ceil(result.count / SALES_PAGE_SIZE))
  if (page > lastPage) {
    page = lastPage
    result = await read(page)
  }
  return {
    query,
    page,
    count: result.count,
    sales: result.data.map((sale): SaleRow => ({
      id: sale.id,
      createdAt: sale.created_at,
      total: sale.total,
      status: sale.status,
      soldBy: sale.sold_by?.full_name ?? '—',
    })),
  }
}

export function useSales(query: SalesQuery) {
  const fetchSales = useCallback(
    async () => ({ data: await loadSales(query), error: null }),
    [query],
  )
  const { data, ...state } = useAsyncResource(
    fetchSales,
    'No se pudieron cargar las ventas',
    {
      sales: [] as SaleRow[],
      query: null as SalesQuery | null,
      count: 0,
      page: 1,
    },
  )
  const { refresh } = state
  const voidSale = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.rpc('void_sale', { p_sale_id: id })
        if (error) throw error
        toast.success('Venta anulada')
        await refresh()
        return true
      } catch (cause) {
        reportError('No se pudo anular la venta', cause)
        return false
      }
    },
    [refresh],
  )
  return { ...data, ...state, voidSale, current: data.query === query }
}
