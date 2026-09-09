import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { isEnPerdida } from '../../lib/pricing'
import type { Database } from '../../lib/database.types'

type PurchaseOrderRow = Database['public']['Tables']['purchase_orders']['Row']

export type PurchaseOrder = PurchaseOrderRow & {
  supplier: { name: string } | null
  purchase_order_items: {
    quantity: number
    unit_cost: number
    subtotal: number
    product: { name: string; price: number; active: boolean } | null
  }[]
}

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(
        '*, supplier:suppliers(name), purchase_order_items(quantity, unit_cost, subtotal, product:products(name, price, active))',
      )
      .order('created_at', { ascending: false })

    if (error) {
      reportError('No se pudieron cargar las órdenes de compra', error)
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
      // La fecha real de compra (la impresa en el ticket), no la fecha en
      // que se confirma la captura -- pueden ser días distintos. Ausente
      // en una orden manual, que no viene de un ticket fechado.
      ticketDate?: string | null
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
          ticket_date: values.ticketDate ?? null,
        })
        .select('id')
        .single()

      if (orderError || !order) {
        reportError('No se pudo crear la orden de compra', orderError)
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
        reportError('La orden se creó pero no se pudieron guardar sus líneas', itemsError)
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
        reportError('No se pudo recibir la orden', error)
        return false
      }
      toast.success('Orden recibida — inventario actualizado')

      // receive_purchase_order acaba de fijar products.cost al unit_cost
      // de cada renglón (si no era cero) -- es el momento correcto para
      // avisar si ese costo nuevo ya alcanzó o superó el precio de venta.
      // No se sugiere un precio nuevo (haría falta saber qué margen
      // quiere el dueño); solo se señala que hay que revisarlo, aquí
      // mismo en vez de esperar a que alguien lo note por accidente en
      // Catálogo.
      const orden = orders.find((o) => o.id === orderId)
      const enPerdida = (orden?.purchase_order_items ?? []).filter(
        (item) =>
          item.unit_cost > 0 &&
          !!item.product &&
          isEnPerdida({
            active: item.product.active,
            price: item.product.price,
            cost: item.unit_cost,
          }),
      )
      if (enPerdida.length > 0) {
        toast.warning(
          `Revisa el precio de venta: ${enPerdida.map((i) => i.product!.name).join(', ')} -- su costo ya alcanzó o superó lo que cobras por él.`,
          { duration: 10000 },
        )
      }

      await refresh()
      return true
    },
    [refresh, orders],
  )

  return { orders, loading, createOrder, receiveOrder }
}
