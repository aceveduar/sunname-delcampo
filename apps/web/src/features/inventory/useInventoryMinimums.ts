import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSupabaseList } from '@/lib/useSupabaseList'
import { reportError } from '@/lib/errors'
import { toast } from 'sonner'

type Minimum = { product_id: string; minimum_quantity: number }
export function useInventoryMinimums() {
  const fetcher = useCallback(
    () => supabase.from('inventory_minimums').select('*'),
    [],
  )
  const { items, error, loading, refresh } = useSupabaseList<Minimum>(
    fetcher,
    'No se pudieron cargar los mínimos de inventario',
  )
  const saveMinimum = async (productId: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity < 0) return false
    try {
      const { error } = await supabase
        .from('inventory_minimums')
        .upsert({ product_id: productId, minimum_quantity: quantity })
      if (error) throw error
      await refresh()
      toast.success('Mínimo actualizado')
      return true
    } catch (error) {
      reportError('No se pudo guardar el mínimo', error)
      return false
    }
  }
  return {
    minimums: new Map(
      items.map((row) => [row.product_id, row.minimum_quantity]),
    ),
    error,
    loading,
    refresh,
    saveMinimum,
  }
}
