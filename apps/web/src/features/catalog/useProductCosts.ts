import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'

/** Costo por producto, para poder avisar cuando ya no alcanza el margen
 * (ver ProductsTab, badge "En pérdida"). Aparte de useProducts (que lee
 * product_catalog, sin costo -- CLAUDE.md §6) porque solo esta pantalla,
 * ya restringida a owner/local_admin, lo necesita; products_select en
 * RLS ya es admin-only, así que no hace falta filtrar nada aquí. */
export function useProductCosts() {
  const [costsById, setCostsById] = useState<Map<string, number>>(new Map())

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('id, cost')
    if (error) {
      reportError('No se pudieron cargar los costos', error)
      return
    }
    setCostsById(new Map((data ?? []).map((p) => [p.id, p.cost])))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { costsById, refresh }
}
