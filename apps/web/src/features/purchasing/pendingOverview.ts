import { supabase } from '@/lib/supabase'

/** Ordered incluye entregas parciales; se completa al recibir el remanente. */
export async function loadPendingPurchases() {
  const { data, error, count } = await supabase
    .from('purchase_orders')
    .select('id,created_at,supplier:suppliers(name)', { count: 'exact' })
    .eq('status', 'ordered')
    .order('created_at')
    .order('id')
    .limit(4)
  if (error) throw error
  if (count === null)
    throw new Error('No se pudo contar las compras pendientes')
  return { count, items: data ?? [] }
}
