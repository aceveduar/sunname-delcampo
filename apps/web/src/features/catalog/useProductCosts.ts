import { useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/readAllPages'
import { useAsyncResource } from '@/lib/useAsyncResource'

/** Los costos se consultan aparte del catálogo público y solo para administradores. */
export function useProductCosts(enabled: boolean) {
  const fetcher = useCallback(
    async () => ({
      data: enabled
        ? await readAllPages((from, to) =>
            supabase
              .from('products')
              .select('id, cost', { count: 'exact' })
              .order('id')
              .range(from, to),
          )
        : [],
      error: null,
    }),
    [enabled],
  )
  const { data, loading, error, refresh } = useAsyncResource<
    { id: string; cost: number }[]
  >(fetcher, 'No se pudieron cargar los costos', [])
  // No presentar un margen anterior o no consultado como vigente.
  const costsById = useMemo(
    () =>
      new Map(
        enabled && !loading && !error
          ? data.map((row) => [row.id, row.cost])
          : [],
      ),
    [enabled, loading, error, data],
  )
  return {
    costsById,
    loading: enabled && loading,
    error: enabled ? error : null,
    refresh,
  }
}
