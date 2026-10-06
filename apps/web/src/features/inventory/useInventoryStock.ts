import { useCallback } from 'react'
import { readAllPages } from '@/lib/readAllPages'
import { supabase } from '../../lib/supabase'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Product } from '@/features/catalog/useProducts'

export type StockRow = {
  product: Product
  quantityOnHand: number
}

export function useInventoryStock() {
  const fetchStock = useCallback(async () => {
    const [products, stock] = await Promise.all([
      readAllPages((from, to) =>
        supabase
          .from('product_catalog')
          .select('*', { count: 'exact' })
          .eq('track_inventory', true)
          .eq('active', true)
          .order('name')
          .order('id')
          .range(from, to),
      ),
      readAllPages((from, to) =>
        supabase
          .from('inventory_stock')
          .select('product_id, quantity_on_hand', { count: 'exact' })
          .order('product_id')
          .range(from, to),
      ),
    ])

    const stockMap = new Map(
      (stock ?? []).map((row) => [row.product_id, row.quantity_on_hand ?? 0]),
    )
    const data: StockRow[] = ((products ?? []) as Product[]).map((product) => ({
      product,
      quantityOnHand: stockMap.get(product.id) ?? 0,
    }))
    return { data, error: null }
  }, [])

  const {
    items: rows,
    loading,
    error,
    refresh,
    updatedAt,
  } = useSupabaseList<StockRow>(fetchStock, 'No se pudo cargar el inventario')

  return { rows, loading, error, refresh, updatedAt }
}
