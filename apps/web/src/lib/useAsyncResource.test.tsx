import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAsyncResource } from './useAsyncResource'

vi.mock('./errors', () => ({ reportError: vi.fn() }))
afterEach(cleanup)

describe('Carga recuperable', () => {
  it('conserva los últimos datos y la fecha si falla un refresco; permite reintentar', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ data: [1], error: null })
      .mockRejectedValueOnce(new Error('Red'))
      .mockResolvedValueOnce({ data: [2], error: null })
    const { result } = renderHook(() =>
      useAsyncResource<number[]>(fetcher, 'No se pudo cargar', []),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const date = result.current.updatedAt
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.data).toEqual([1])
    expect(result.current.error).toBe('No se pudo cargar')
    expect(result.current.updatedAt).toBe(date)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual([2])
  })

  it('ignora respuestas tardías de una consulta anterior', async () => {
    let finish!: (value: { data: number[]; error: null }) => void
    const oldFetch = vi.fn(
      () =>
        new Promise<{ data: number[]; error: null }>((resolve) => {
          finish = resolve
        }),
    )
    const newFetch = vi.fn().mockResolvedValue({ data: [2], error: null })
    const { result, rerender } = renderHook(
      ({ fetcher }) => useAsyncResource<number[]>(fetcher, 'Error', []),
      { initialProps: { fetcher: oldFetch } },
    )
    rerender({ fetcher: newFetch })
    await waitFor(() => expect(result.current.data).toEqual([2]))
    await act(async () => {
      finish({ data: [1], error: null })
    })
    expect(result.current.data).toEqual([2])
  })

  it('distingue una respuesta fallida de una lista vacía', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error('Falló') })
    const { result } = renderHook(() =>
      useAsyncResource<number[]>(fetcher, 'Error al cargar', []),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Error al cargar')
    expect(result.current.updatedAt).toBeNull()
  })
})
