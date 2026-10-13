import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    supabase: createClient('https://catalog-test.invalid', 'test-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchMock },
    }),
  }
})
beforeEach(() => {
  fetchMock.mockReset()
})
afterEach(cleanup)

it('consulta categorías y unidades completas, con orden estable, y conserva datos si falla la recarga', async () => {
  let fail = false
  const reads: URL[] = []
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input)
    reads.push(url)
    if (fail)
      return new Response(JSON.stringify({ message: 'Sin acceso' }), {
        status: 403,
      })
    const offset = Number(url.searchParams.get('offset'))
    const data = Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({
      id: String(i + offset),
      name: 'Referencia ' + (i + offset),
      code: 'U' + (i + offset),
      active: true,
      parent_id: null,
    }))
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': '0-499/501',
      },
    })
  })
  const { result } = renderHook(() => ({
    categories: useCategories(),
    units: useUnits(),
  }))
  await waitFor(
    () => {
      expect(result.current.categories.error).toBeNull()
      expect(result.current.categories.categories).toHaveLength(501)
      expect(result.current.units.units).toHaveLength(501)
    },
    { timeout: 5000 },
  )
  for (const table of ['product_categories', 'units_of_measure']) {
    const queries = reads.filter((url) => url.pathname.endsWith('/' + table))
    expect(queries.map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '500',
    ])
    expect(
      queries.every(
        (url) => url.searchParams.get('order') === 'name.asc,id.asc',
      ),
    ).toBe(true)
  }
  fail = true
  await act(async () => {
    await result.current.categories.refresh()
    await result.current.units.refresh()
  })
  expect(result.current.categories.error).toBeTruthy()
  expect(result.current.units.error).toBeTruthy()
  expect(result.current.categories.categories).toHaveLength(501)
  expect(result.current.units.units).toHaveLength(501)
})
