import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePurchaseOrders } from './usePurchaseOrders'
import { useSuppliers } from './useSuppliers'
import { PurchaseReceiptHistory } from './PurchaseReceiptHistory'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    supabase: createClient('https://purchases-test.invalid', 'test-key', {
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

it('consulta más de 500 órdenes con orden estable y conserva la lista completa si falla una página', async () => {
  let fail = false
  const queries: URL[] = []
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === 'object' && 'url' in input ? input.url : String(input),
    )
    queries.push(url)
    const offset = Number(url.searchParams.get('offset'))
    if (fail && offset === 500)
      return new Response(JSON.stringify({ message: 'No disponible' }), {
        status: 403,
      })
    return new Response(
      JSON.stringify(
        Array.from({ length: offset ? 1 : 500 }, (_, i) => ({
          id: String(offset + i),
          notes: fail ? 'parcial' : 'correcta',
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
  const suppliers = renderHook(() => useSuppliers())
  const { result } = renderHook(() => usePurchaseOrders())
  await waitFor(() => expect(result.current.orders).toHaveLength(501))
  await waitFor(() =>
    expect(suppliers.result.current.suppliers).toHaveLength(501),
  )
  const orderQueries = queries.filter((url) =>
    url.pathname.endsWith('/purchase_orders'),
  )
  const supplierQueries = queries.filter((url) =>
    url.pathname.endsWith('/suppliers'),
  )
  expect(supplierQueries.map((url) => url.searchParams.get('offset'))).toEqual([
    '0',
    '500',
  ])
  expect(
    supplierQueries.every(
      (url) => url.searchParams.get('order') === 'name.asc,id.asc',
    ),
  ).toBe(true)
  expect(orderQueries.map((url) => url.searchParams.get('offset'))).toEqual([
    '0',
    '500',
  ])
  expect(
    orderQueries.every(
      (url) => url.searchParams.get('order') === 'created_at.desc,id.desc',
    ),
  ).toBe(true)
  fail = true
  await act(async () => {
    await Promise.all([
      result.current.refresh(),
      suppliers.result.current.refresh(),
    ])
  })
  expect(result.current.error).toBeTruthy()
  expect(result.current.orders).toHaveLength(501)
  expect(result.current.orders[0].notes).toBe('correcta')
  expect(suppliers.result.current.error).toBeTruthy()
  expect(suppliers.result.current.suppliers).toHaveLength(501)
})

it('conserva y distingue la página anterior del historial al fallar, bloquea paginar y permite recuperar', async () => {
  let fail = false
  fetchMock.mockImplementation(async (input: string | URL | Request) => {
    const offset = Number(
      new URL(
        typeof input === 'object' && 'url' in input ? input.url : String(input),
      ).searchParams.get('offset'),
    )
    if (offset && fail)
      return new Response(JSON.stringify({ message: 'No disponible' }), {
        status: 403,
      })
    return new Response(
      JSON.stringify([
        {
          id: 'r' + offset,
          actor_name: offset ? 'Ana' : 'José',
          created_at: '2026-10-13T12:00:00Z',
          notes: null,
          items: [{ product_name: 'Arroz', quantity: 2 }],
        },
      ]),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': offset + '-' + offset + '/11',
        },
      },
    )
  })
  render(<PurchaseReceiptHistory orderId="order" />)
  await screen.findByText('José')
  fail = true
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await screen.findByText(
    'Mostrando la última página consultada correctamente.',
  )
  expect(screen.getByText('José')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('Ana')
  expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
})
