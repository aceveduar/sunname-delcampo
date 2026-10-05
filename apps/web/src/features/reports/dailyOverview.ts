import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/readAllPages'
import { reportRange } from '@/lib/dateRange'

/** Resumen público para Inicio; solo ventas completadas del día local hasta la consulta. */
export async function loadDailyOverview() {
  const now = new Date()
  const range = reportRange('today', now)!
  const rows = await readAllPages((from, to) =>
    supabase
      .from('sales')
      .select('id,total,created_at', { count: 'exact' })
      .eq('status', 'completed')
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  const cents = rows.reduce((sum, row) => sum + Math.round(row.total * 100), 0)
  return {
    total: cents / 100,
    tickets: rows.length,
    average: rows.length ? cents / 100 / rows.length : 0,
    date: now.toISOString(),
  }
}
