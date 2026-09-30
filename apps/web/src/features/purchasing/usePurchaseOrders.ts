import { useCreatePurchaseOrder } from './useCreatePurchaseOrder'
import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Database } from '../../lib/database.types'

type PurchaseOrderRow = Database['public']['Tables']['purchase_orders']['Row']

export type PurchaseOrder = PurchaseOrderRow & {
  supplier: { name: string } | null
  purchase_order_items: {
    id: string
    received_quantity: number
    quantity: number
    unit_cost: number
    subtotal: number
    product: {
      name: string
      price: number
      active: boolean
      unit?: { code: string } | null
    } | null
  }[]
}

export function usePurchaseOrders() {
  // El join no coincide exacto con el tipo generado (las relaciones
  // anidadas salen más laxas de lo que sabemos que son) -- se castea
  // aquí, en el único lugar que arma esta consulta.
  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(
        '*, supplier:suppliers(name), purchase_order_items(id, received_quantity, quantity, unit_cost, subtotal, product:products(name, price, active, unit:units_of_measure(code)))',
      )
      .order('created_at', { ascending: false })
    return { data: data as PurchaseOrder[] | null, error }
  }, [])
  const {
    items: orders,
    loading,
    error,
    refresh,
  } = useSupabaseList<PurchaseOrder>(
    fetchOrders,
    'No se pudieron cargar las órdenes de compra',
  )

  const createOrder = useCreatePurchaseOrder(refresh)

  return { orders, loading, error, refresh, createOrder }
}
