import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'

const WINDOW_DAYS = 30

/** Ids de los productos más vendidos en los últimos 30 días, para el
 * acceso rápido de Caja cuando no hay búsqueda activa. Se cuenta por
 * número de renglones de venta (cuántas veces se pidió), no por
 * cantidad -- sumar kilos de un producto a granel contra piezas de un
 * abarrote no da un ranking comparable. */
export function useTopSellingProducts(limit = 12) {
  const [productIds, setProductIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id')
        .eq('status', 'completed')
        .gte('created_at', since)

      if (salesError) {
        if (!cancelled) reportError('No se pudieron cargar las ventas recientes', salesError)
        return
      }

      const saleIds = (sales ?? []).map((s) => s.id)
      if (saleIds.length === 0) {
        if (!cancelled) setProductIds([])
        return
      }

      // sale_items_public, no sale_items: la tabla base es admin-only
      // desde el hallazgo Crítico de la auditoría del 13 de septiembre
      // (unit_cost -- el margen de cada venta -- era legible por
      // cualquier cajero). Esta vista trae lo mismo salvo unit_cost, que
      // aquí ni se usa.
      const { data: items, error: itemsError } = await supabase
        .from('sale_items_public')
        .select('product_id')
        .in('sale_id', saleIds)

      if (itemsError) {
        if (!cancelled) reportError('No se pudieron cargar los productos más vendidos', itemsError)
        return
      }

      const counts = new Map<string, number>()
      for (const row of items ?? []) {
        if (!row.product_id) continue
        counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)
      }
      const ranked = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id)

      if (!cancelled) setProductIds(ranked)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [limit])

  return productIds
}
