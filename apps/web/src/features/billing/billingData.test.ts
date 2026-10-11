import { beforeEach, expect, it, vi } from 'vitest'
import {
  createBillingQuery,
  INITIAL_BILLING_VALUES,
  loadBillableSession,
  loadBillableSessions,
  requestBillingInvoice,
} from './billingData'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@/lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    supabase: createClient('https://billing-test.invalid', 'test-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchMock },
    }),
  }
})
const invoice = {
  id: 'invoice',
  status: 'pending',
  total: 1250,
  uuid_fiscal: null,
  error_message: null,
  requested_at: '2026-10-11T12:00:00Z',
}
const session = {
  id: 'session',
  closed_at: '2026-10-11T11:00:00Z',
  closing_amount: 800,
  closed_by: { full_name: 'Ana' },
  fiscal_invoices: invoice,
}
function response(data: unknown, count?: number) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      ...(count === undefined ? {} : { 'Content-Range': `0-19/${count}` }),
    },
  })
}
beforeEach(() => {
  fetchMock.mockReset()
})

it('suma todas las páginas de ventas en centavos y distingue efectivo de solicitud', async () => {
  const reads: URL[] = []
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input)
    reads.push(url)
    if (url.pathname.endsWith('/cash_sessions')) return response([session], 1)
    const offset = Number(url.searchParams.get('offset'))
    return response(
      Array.from({ length: offset === 0 ? 500 : 1 }, (_, n) => ({
        id: `${n + offset}`,
        cash_session_id: 'session',
        total: 0.01,
      })),
      501,
    )
  })
  const result = await loadBillableSessions(
    createBillingQuery(INITIAL_BILLING_VALUES),
  )
  expect(result.rows[0]).toMatchObject({
    cashCounted: 800,
    salesTotal: 5.01,
    saleCount: 501,
    invoice: { total: 1250 },
  })
  const sales = reads.filter((url) => url.pathname.endsWith('/sales'))
  expect(sales.map((url) => url.searchParams.get('offset'))).toEqual([
    '0',
    '500',
  ])
  for (const url of sales) {
    expect(url.searchParams.get('status')).toBe('eq.completed')
    expect(url.searchParams.get('cash_session_id')).toBe('in.(session)')
    expect(url.searchParams.get('order')).toBe('id.asc')
  }
})

it.each(['none', 'error'] as const)(
  'filtra %s en servidor y pagina el historial más allá de veinte cortes',
  async (status) => {
    let request!: URL
    fetchMock.mockImplementation(async (input: string) => {
      request = new URL(input)
      return response([], 42)
    })
    const query = createBillingQuery({
      start: '2026-10-01',
      end: '2026-10-11',
      status,
    })
    query.page = 2
    await loadBillableSessions(query)
    expect(request.searchParams.get('offset')).toBe('40')
    expect(request.searchParams.get('limit')).toBe('20')
    expect(request.searchParams.get('order')).toBe('closed_at.desc,id.desc')
    expect(request.searchParams.getAll('closed_at')).toEqual([
      `gte.${query.range!.from}`,
      `lt.${query.range!.to}`,
    ])
    expect(request.searchParams.get('fiscal_invoices')).toBe(
      status === 'none' ? 'is.null' : 'not.is.null',
    )
    expect(request.searchParams.get('fiscal_invoices.status')).toBe(
      status === 'error' ? 'eq.error' : null,
    )
  },
)

it('corrige una página que dejó de existir y conserva efectivo no registrado', async () => {
  const offsets: string[] = []
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/sales')) return response([], 0)
    offsets.push(url.searchParams.get('offset')!)
    return response(
      offsets.length === 1 ? [] : [{ ...session, closing_amount: null }],
      21,
    )
  })
  const result = await loadBillableSessions({
    ...createBillingQuery(INITIAL_BILLING_VALUES),
    page: 4,
  })
  expect(offsets).toEqual(['80', '20'])
  expect(result.page).toBe(1)
  expect(result.rows[0].cashCounted).toBeNull()
})

it('rechaza una suma incompleta cuando falla la segunda página de ventas', async () => {
  fetchMock.mockImplementation(async (input: string) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/cash_sessions')) return response(session)
    if (url.searchParams.get('offset') === '0')
      return response(
        Array.from({ length: 500 }, (_, id) => ({
          id,
          cash_session_id: 'session',
          total: 1,
        })),
        501,
      )
    return new Response(JSON.stringify({ message: 'Consulta rechazada' }), {
      status: 403,
    })
  })
  await expect(loadBillableSession('session')).rejects.toMatchObject({
    message: 'Consulta rechazada',
  })
})

it.each([
  { start: '2026-10-01', end: '' },
  { start: '2026-10-12', end: '2026-10-01' },
  { start: '2026-02-30', end: '2026-03-01' },
])('rechaza fechas incompletas o inválidas: %j', (dates) => {
  expect(() => createBillingQuery({ ...dates, status: 'all' })).toThrow(
    'Completa ambas fechas',
  )
})

it('recupera una solicitud existente sin escribir de nuevo', async () => {
  fetchMock.mockResolvedValue(response(invoice))
  expect(await requestBillingInvoice('session')).toEqual(invoice)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(String(fetchMock.mock.calls[0][0])).toContain('/fiscal_invoices?')
})

it('reconcilia una respuesta fallida con el total realmente registrado', async () => {
  fetchMock
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Respuesta perdida' }), {
        status: 400,
      }),
    )
    .mockResolvedValueOnce(response(invoice))
  expect(await requestBillingInvoice('session')).toEqual(invoice)
  const rpc = fetchMock.mock.calls[1]
  expect(String(rpc[0])).toContain('/rpc/request_global_invoice')
  expect(JSON.parse(rpc[1].body)).toEqual({ p_cash_session_id: 'session' })
})

it('no escribe si no puede verificar una solicitud previa', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ message: 'Sin acceso' }), { status: 403 }),
  )
  await expect(requestBillingInvoice('session')).rejects.toMatchObject({
    message: 'Sin acceso',
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
