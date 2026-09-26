import { useCallback } from 'react'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import type { Database } from '@/lib/database.types'

type SaleStatus = Database['public']['Enums']['sale_status']

export type SaleRow = {
  id: string
  createdAt: string
  total: number
  status: SaleStatus
  soldBy: string
}

export function useSales(from: string, to: string) {
  const fetchSales = useCallback(async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('id, created_at, total, status, sold_by:profiles(full_name)')
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at', { ascending: false })
      .limit(50)

    return {
      data: {
        from,
        to,
        sales: (data ?? []).map((s) => ({
          id: s.id,
          createdAt: s.created_at,
          total: s.total,
          status: s.status,
          soldBy: s.sold_by?.full_name ?? '—',
        })),
      },
      error,
    }
  }, [from, to])
  const { data, ...state } = useAsyncResource(
    fetchSales,
    'No se pudieron cargar las ventas',
    { sales: [] as SaleRow[], from: '', to: '' },
  )
  const { refresh } = state

  const voidSale = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc('void_sale', { p_sale_id: id })
      if (error) {
        // Anular una venta revierte inventario real y corrige un registro
        // financiero ya cerrado -- CLAUDE.md §14.2 exige aviso explícito
        // (Sentry + toast) para este tipo de operación, igual que abrir/
        // cerrar caja y registrar una venta.
        reportError('No se pudo anular la venta', error)
        return false
      }
      toast.success('Venta anulada')
      await refresh()
      return true
    },
    [refresh],
  )

  return {
    sales: data.sales,
    loadedFrom: data.from,
    loadedTo: data.to,
    ...state,
    voidSale,
  }
}
