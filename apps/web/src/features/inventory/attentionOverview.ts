import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/readAllPages'
import { needsReplenishment } from './replenishment'

/** Interfaz de consulta para Inicio; nunca expone costos ni suma unidades diferentes. */
export async function loadInventoryAttention() {
  const [products, stock, minimums] = await Promise.all([
    readAllPages((from, to) =>
      supabase
        .from('product_catalog')
        .select('id,name', { count: 'exact' })
        .eq('active', true)
        .eq('track_inventory', true)
        .order('id')
        .range(from, to),
    ),
    readAllPages((from, to) =>
      supabase
        .from('inventory_stock')
        .select('product_id,quantity_on_hand', { count: 'exact' })
        .order('product_id')
        .range(from, to),
    ),
    readAllPages((from, to) =>
      supabase
        .from('inventory_minimums')
        .select('product_id,minimum_quantity', { count: 'exact' })
        .order('product_id')
        .range(from, to),
    ),
  ])
  const quantities = new Map(
    stock.map((row) => [row.product_id, row.quantity_on_hand ?? 0]),
  )
  const levels = new Map(
    minimums.map((row) => [row.product_id, row.minimum_quantity]),
  )
  const items = products
    .map((product) => ({
      id: product.id!,
      name: product.name!,
      quantity: quantities.get(product.id!) ?? 0,
      minimum: levels.get(product.id!) ?? 0,
    }))
    .filter(
      (row) =>
        row.quantity <= 0 || needsReplenishment(row.quantity, row.minimum),
    )
    .sort(
      (a, b) =>
        Number(b.quantity <= 0) - Number(a.quantity <= 0) ||
        a.name.localeCompare(b.name, 'es'),
    )
  return {
    out: items.filter((row) => row.quantity <= 0).length,
    low: items.filter((row) => needsReplenishment(row.quantity, row.minimum))
      .length,
    total: items.length,
    items: items.slice(0, 4),
  }
}
