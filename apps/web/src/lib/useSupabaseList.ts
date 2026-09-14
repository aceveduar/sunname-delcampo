import { useCallback, useEffect, useState } from 'react'
import { reportError } from './errors'

type ListResult<T> = { data: T[] | null; error: unknown }

/** Lo que 15+ hooks de datos (useCategories, useUnits, useCustomers...)
 * repetían a mano: lista + cargando + refrescar. Lo que sí varía por
 * hook (tabla, columnas, joins, copy del error) sigue siendo cosa de
 * cada uno -- por eso `fetcher` recibe la consulta ya armada como
 * función, no un config de {table, select}: un config no puede expresar
 * un select con join (`usePurchaseOrders`) ni un merge de varias
 * consultas (`useInventoryStock`) sin escapes que terminan siendo tan
 * complejos como escribir la consulta directo.
 *
 * `fetcher` debe ser una referencia estable (envuelta en `useCallback`
 * por quien llama) -- si cambia en cada render, `refresh` cambia con
 * ella y el efecto de abajo vuelve a pedir datos sin parar. Es la misma
 * disciplina que cada uno de estos hooks ya se exige a sí mismo hoy con
 * su propio `refresh`, no una regla nueva. */
export function useSupabaseList<T>(
  fetcher: () => PromiseLike<ListResult<T>>,
  errorMessage: string,
) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await fetcher()
    if (error) {
      reportError(errorMessage, error)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }, [fetcher, errorMessage])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, refresh, setItems }
}
