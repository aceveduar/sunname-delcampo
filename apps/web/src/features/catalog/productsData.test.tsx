import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useProducts } from './useProducts'
import { useProductCosts } from './useProductCosts'

const { fetchMock, success } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  success: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success } }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    supabase: createClient('https://products-test.invalid', 'test-key', {
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
  success.mockReset()
})
afterEach(cleanup)

it('lee todas las páginas con orden estable y conserva el catálogo completo si falla una página posterior', async () => {
  let fail = false
  const reads: URL[] = []
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input)
    reads.push(url)
    const offset = Number(url.searchParams.get('offset'))
    if (fail && offset === 500)
      return new Response(JSON.stringify({ message: 'Sin acceso' }), {
        status: 403,
      })
    return new Response(
      JSON.stringify(
        Array.from({ length: offset ? 1 : 500 }, (_, i) => ({
          id: String(offset + i),
          name: fail ? 'Nombre parcial' : 'Producto ' + (offset + i),
          cost: i + 1,
        })),
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': offset ? '500-500/501' : '0-499/501',
        },
      },
    )
  })
  const { result } = renderHook(() => ({
    catalog: useProducts(),
    costs: useProductCosts(true),
  }))
  await waitFor(() => {
    expect(result.current.catalog.products).toHaveLength(501)
    expect(result.current.costs.costsById.size).toBe(501)
  })
  for (const [table, order] of [
    ['product_catalog', 'name.asc,id.asc'],
    ['products', 'id.asc'],
  ]) {
    const urls = reads.filter((url) => url.pathname.endsWith('/' + table))
    expect(urls.map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '500',
    ])
    expect(urls.every((url) => url.searchParams.get('order') === order)).toBe(
      true,
    )
  }
  fail = true
  await act(async () => {
    await Promise.all([
      result.current.catalog.refresh(),
      result.current.costs.refresh(),
    ])
  })
  expect(result.current.catalog.error).toBeTruthy()
  expect(result.current.catalog.products).toHaveLength(501)
  expect(result.current.catalog.products[0].name).toBe('Producto 0')
  expect(result.current.costs.error).toBeTruthy()
  expect(result.current.costs.costsById.size).toBe(0)
})

it('no consulta costos sin permisos, ni siquiera al actualizar', async () => {
  const { result } = renderHook(() => useProductCosts(false))
  await act(async () => {
    await result.current.refresh()
  })
  expect(fetchMock).not.toHaveBeenCalled()
  expect(result.current.costsById.size).toBe(0)
})

it('no anuncia una actualización ni un lote exitosos cuando el servidor no devuelve el producto afectado', async () => {
  fetchMock.mockImplementation(async (_input: string, init?: RequestInit) => {
    if (init?.method === 'PATCH')
      return new Response('null', {
        headers: { 'Content-Type': 'application/json' },
      })
    return new Response('[]', {
      headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' },
    })
  })
  const { result } = renderHook(() => useProducts())
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => {
    expect(await result.current.updateProduct('missing', { price: 25 })).toBe(
      false,
    )
    expect(
      await result.current.updatePrices([
        { id: 'missing', price: 25, price_per_100g: null },
      ]),
    ).toBe(false)
  })
  expect(success).not.toHaveBeenCalled()
})
