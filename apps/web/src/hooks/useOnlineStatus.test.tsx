import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useOnlineStatus } from './useOnlineStatus'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('actualiza la disponibilidad al perder y recuperar la red', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const { result } = renderHook(useOnlineStatus)
  expect(result.current).toBe(true)
  act(() => {
    online.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
  })
  expect(result.current).toBe(false)
  act(() => {
    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
  })
  expect(result.current).toBe(true)
})
