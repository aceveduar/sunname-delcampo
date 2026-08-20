import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type Product = Database['public']['Tables']['products']['Row']

export type StockRow = {
  product: Product
  quantityOnHand: number
}

export function useInventoryStock() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: products, error: productsError }, { data: stock, error: stockError }] =
      await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('track_inventory', true)
          .eq('active', true)
          .order('name'),
        supabase.from('inventory_stock').select('product_id, quantity_on_hand'),
      ])

    const error = productsError ?? stockError
    if (error) {
      toast.error('No se pudo cargar el inventario', { description: error.message })
      setLoading(false)
      return
    }

    const stockMap = new Map(
      (stock ?? []).map((row) => [row.product_id, row.quantity_on_hand ?? 0]),
    )
    setRows(
      (products ?? []).map((product) => ({
        product,
        quantityOnHand: stockMap.get(product.id) ?? 0,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, refresh }
}
