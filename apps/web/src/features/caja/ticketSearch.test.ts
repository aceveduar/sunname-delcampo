import { beforeEach, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { createTicketQuery, loadTickets } from './ticketSearch'
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const response = vi.fn()
const request = {
  select: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: response,
}
const values = {
  start: '2026-10-01',
  end: '2026-10-07',
  amount: '141.50',
  folio: 'abcd1234',
  status: 'voided' as const,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(supabase.from).mockReturnValue(request as never)
  response.mockResolvedValue({ data: [], count: 0, error: null })
})
it('aplica filtros en servidor y pagina con un orden estable', async () => {
  const query = { ...createTicketQuery(values), page: 1 }
  response.mockResolvedValue({ data: [], count: 45, error: null })
  const data = await loadTickets(query)
  expect(supabase.from).toHaveBeenCalledWith('sales')
  expect(request.eq.mock.calls).toEqual([
    ['total', 141.5],
    ['status', 'voided'],
  ])
  expect(request.gte).toHaveBeenCalledWith(
    'created_at',
    new Date(2026, 9, 1).toISOString(),
  )
  expect(request.lt).toHaveBeenCalledWith(
    'created_at',
    new Date(2026, 9, 8).toISOString(),
  )
  expect(request.gte).toHaveBeenCalledWith(
    'id',
    'abcd1234-0000-0000-0000-000000000000',
  )
  expect(request.lte).toHaveBeenCalledWith(
    'id',
    'abcd1234-ffff-ffff-ffff-ffffffffffff',
  )
  expect(request.order.mock.calls).toEqual([
    ['created_at', { ascending: false }],
    ['id', { ascending: false }],
  ])
  expect(response).toHaveBeenCalledWith(20, 39)
  expect(data.query).toBe(query)
  expect(data.page).toBe(1)
})
it('Todas no limita el estado y retrocede si desaparece la última página', async () => {
  const query = {
    ...createTicketQuery({ ...values, status: 'all', amount: '', folio: '' }),
    page: 2,
  }
  response.mockResolvedValue({ data: [], count: 22, error: null })
  const data = await loadTickets(query)
  expect(request.eq).not.toHaveBeenCalled()
  expect(response.mock.calls).toEqual([
    [40, 59],
    [20, 39],
  ])
  expect(data.page).toBe(1)
})
it('no interpreta respuestas incompletas ni fallos como cero ventas', async () => {
  const query = createTicketQuery(values)
  response.mockResolvedValueOnce({ data: [], count: null, error: null })
  await expect(loadTickets(query)).rejects.toThrow('Respuesta incompleta')
  response.mockResolvedValueOnce({ data: null, count: 0, error: null })
  await expect(loadTickets(query)).rejects.toThrow('Respuesta incompleta')
  const cause = new Error('Sin conexión')
  response.mockResolvedValueOnce({ data: null, count: null, error: cause })
  await expect(loadTickets(query)).rejects.toBe(cause)
})
