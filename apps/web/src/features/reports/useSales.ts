import { useCallback, useEffect, useState } from 'react'
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
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('id, created_at, total, status, sold_by:profiles(full_name)')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      toast.error('No se pudieron cargar las ventas', { description: error.message })
    } else {
      setSales(
        (data ?? []).map((s) => ({
          id: s.id,
          createdAt: s.created_at,
          total: s.total,
          status: s.status,
          soldBy: s.sold_by?.full_name ?? '—',
        })),
      )
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    refresh()
  }, [refresh])

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

  return { sales, loading, voidSale }
}
