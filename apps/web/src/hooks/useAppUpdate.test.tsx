import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppUpdate } from './useAppUpdate'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('detecta otra versión sin recargar y usa una consulta sin caché', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ version: 'new' }) })
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useAppUpdate('old', true))
  await waitFor(() => expect(result.current).toBe(true))
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining('version.json'),
    expect.objectContaining({ cache: 'no-store' }),
  )
})
it('ignora fallos de red y comprueba de nuevo al recuperar foco', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ok: true, json: async () => ({ version: 'same' }) })
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useAppUpdate('same', true))
  await act(async () => {})
  expect(result.current).toBe(false)
  await act(async () => {
    window.dispatchEvent(new Event('focus'))
  })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(result.current).toBe(false)
})
