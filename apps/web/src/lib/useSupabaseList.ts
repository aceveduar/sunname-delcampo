import { useCallback } from 'react'
import { useAsyncResource } from './useAsyncResource'

type ListResult<T> = { data: T[] | null; error: unknown }

/** El fetcher debe tener identidad estable, por ejemplo con useCallback. */
export function useSupabaseList<T>(
  fetcher: () => PromiseLike<ListResult<T>>,
  errorMessage: string,
) {
  const load = useCallback(async () => {
    const result = await fetcher()
    return { ...result, data: result.data ?? [] }
  }, [fetcher])
  const {
    data: items,
    setData: setItems,
    ...state
  } = useAsyncResource<T[]>(load, errorMessage, [])
  return { items, setItems, ...state }
}
