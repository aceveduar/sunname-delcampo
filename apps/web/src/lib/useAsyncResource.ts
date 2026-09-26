import { useCallback, useEffect, useRef, useState } from 'react'
import { reportError } from './errors'

type Result<T> = { data: T | null; error: unknown }

/** Conserva la última respuesta correcta e ignora respuestas fuera de orden. */
export function useAsyncResource<T>(
  fetcher: () => PromiseLike<Result<T>>,
  errorMessage: string,
  initialData: T,
) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const generation = useRef({ id: 0 })
  const refresh = useCallback(async () => {
    const current = generation.current
    const id = ++current.id
    setLoading(true)
    try {
      const result = await fetcher()
      if (id !== current.id) return
      if (result.error) throw result.error
      if (result.data === null) throw new Error('Respuesta sin datos')
      setData(result.data)
      setError(null)
      setUpdatedAt(new Date())
    } catch (cause) {
      if (id !== current.id) return
      setError(errorMessage)
      reportError(errorMessage, cause)
    } finally {
      if (id === current.id) setLoading(false)
    }
  }, [fetcher, errorMessage])
  useEffect(() => {
    const current = generation.current
    void refresh()
    return () => {
      current.id++
    }
  }, [refresh])
  return { data, setData, loading, error, updatedAt, refresh }
}
