import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  sidebarPreferenceKey,
  useSidebarPreference,
} from './useSidebarPreference'
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
it('conserva preferencias independientes para Caja y administración al volver y recargar', () => {
  const { result, rerender, unmount } = renderHook(
    ({ checkout }) => useSidebarPreference('user-a', checkout, false),
    { initialProps: { checkout: false } },
  )
  expect(result.current.collapsed).toBe(false)
  act(() => result.current.toggle())
  rerender({ checkout: true })
  expect(result.current.collapsed).toBe(true)
  act(() => result.current.toggle())
  expect(result.current.collapsed).toBe(false)
  rerender({ checkout: false })
  expect(result.current.collapsed).toBe(true)
  unmount()
  expect(
    renderHook(() => useSidebarPreference('user-a', true, false)).result.current
      .collapsed,
  ).toBe(false)
  expect(
    renderHook(() => useSidebarPreference('user-b', true, false)).result.current
      .collapsed,
  ).toBe(true)
})
it('tolera preferencias inválidas y sigue funcionando sin almacenamiento', () => {
  localStorage.setItem(
    sidebarPreferenceKey('user'),
    '{"caja":"no","workspace":42}',
  )
  const { result } = renderHook(() => useSidebarPreference('user', false, true))
  expect(result.current.collapsed).toBe(true)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied')
  })
  act(() => result.current.toggle())
  expect(result.current.collapsed).toBe(false)
})
