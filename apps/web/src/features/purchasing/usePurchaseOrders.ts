import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type PurchaseOrderRow = Database['public']['Tables']['purchase_orders']['Row']

export type PurchaseOrder = PurchaseOrderRow & {
  supplier: { name: string } | null
  purchase_order_items: { quantity: number; unit_cost: number; subtotal: number }[]
}

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, supplier:suppliers(name), purchase_order_items(quantity, unit_cost, subtotal)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('No se pudieron cargar las órdenes de compra', { description: error.message })
    } else {
      setOrders((data ?? []) as PurchaseOrder[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createOrder = useCallback(
    async (values: {
      supplierId: string
      notes: string | null
      items: { productId: string; quantity: number; unitCost: number }[]
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return false

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: values.supplierId,
          notes: values.notes,
          created_by: user.id,
          status: 'ordered',
        })
        .select('id')
        .single()

      if (orderError || !order) {
        toast.error('No se pudo crear la orden de compra', { description: orderError?.message })
        return false
      }

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(
        values.items.map((item) => ({
          purchase_order_id: order.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_cost: item.unitCost,
          subtotal: item.quantity * item.unitCost,
        })),
      )

      if (itemsError) {
        toast.error('La orden se creó pero no se pudieron guardar sus líneas', {
          description: itemsError.message,
        })
        await refresh()
        return false
      }

      toast.success('Orden de compra creada')
      await refresh()
      return true
    },
    [refresh],
  )

  const receiveOrder = useCallback(
    async (orderId: string) => {
      const { error } = await supabase.rpc('receive_purchase_order', {
        p_purchase_order_id: orderId,
      })
      if (error) {
        toast.error('No se pudo recibir la orden', { description: error.message })
        return false
      }
      toast.success('Orden recibida — inventario actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  return { orders, loading, createOrder, receiveOrder }
}
