import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { favoritesKey, useFavoriteProducts } from './useFavoriteProducts'
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
it('conserva el orden, persiste y separa usuarios', () => {
  const { result, unmount } = renderHook(() => useFavoriteProducts('one'))
  act(() => result.current.toggle('b'))
  act(() => result.current.toggle('a'))
  expect(result.current.ids).toEqual(['b', 'a'])
  unmount()
  const saved = renderHook(() => useFavoriteProducts('one'))
  expect(saved.result.current.ids).toEqual(['b', 'a'])
  const other = renderHook(() => useFavoriteProducts('two'))
  expect(other.result.current.ids).toEqual([])
  act(() => saved.result.current.toggle('b'))
  expect(JSON.parse(localStorage.getItem(favoritesKey('one'))!)).toEqual(['a'])
})
it('no indica guardado si falla el almacenamiento', () => {
  const { result } = renderHook(() => useFavoriteProducts('one'))
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw Error('full')
  })
  act(() => result.current.toggle('a'))
  expect(result.current.ids).toEqual([])
})
