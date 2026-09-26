import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Product } from '@/features/catalog/useProducts'

export type StockRow = {
  product: Product
  quantityOnHand: number
}

export function useInventoryStock() {
  const fetchStock = useCallback(async () => {
    const [
      { data: products, error: productsError },
      { data: stock, error: stockError },
    ] = await Promise.all([
      supabase
        .from('product_catalog')
        .select('*')
        .eq('track_inventory', true)
        .eq('active', true)
        .order('name'),
      supabase.from('inventory_stock').select('product_id, quantity_on_hand'),
    ])

    const error = productsError ?? stockError
    if (error) return { data: null, error }

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
  } = useSupabaseList<StockRow>(fetchStock, 'No se pudo cargar el inventario')

  return { rows, loading, error, refresh }
}
