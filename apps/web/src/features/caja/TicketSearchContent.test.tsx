import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TicketSearchContent } from './TicketSearchContent'
import { loadTickets, type TicketQuery } from './ticketSearch'
import { ticketDates, ticketPeriodLabel } from './ticketFilters'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('./ticketSearch', async (original) => ({
  ...(await original<typeof import('./ticketSearch')>()),
  loadTickets: vi.fn(),
}))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./SaleReceiptViewer', () => ({
  SaleReceiptViewer: ({
    saleId,
    onClose,
  }: {
    saleId: string
    onClose: () => void
  }) => (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Copia de ticket</DialogTitle>
        <p>{saleId}</p>
        <button onClick={onClose}>Volver a tickets</button>
      </DialogContent>
    </Dialog>
  ),
}))
const result = (query: TicketQuery) => ({
  query,
  page: query.page,
  count: 45,
  rows: [
    {
      id: `abcdef${query.page.toString().padStart(2, '0')}-0000-4000-8000-000000000000`,
      created_at: '2026-10-01T16:30:00Z',
      total: 141.5,
      status: 'completed' as const,
    },
  ],
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    },
  )
  vi.mocked(loadTickets).mockImplementation(async (query) => result(query))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
async function setup() {
  const onClose = vi.fn()
  render(<TicketSearchContent onClose={onClose} />)
  await screen.findByRole('button', { name: 'Ver ticket abcdef00' })
  return onClose
}
it('aplica fechas rápidas y estado desde la primera página conservando los otros filtros', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await screen.findByRole('button', { name: 'Ver ticket abcdef01' })
  fireEvent.click(screen.getByRole('button', { name: 'Anuladas' }))
  await waitFor(() =>
    expect(vi.mocked(loadTickets).mock.lastCall?.[0]).toMatchObject({
      page: 0,
      filters: { status: 'voided' },
    }),
  )
  await screen.findByRole('button', { name: 'Ver ticket abcdef00' })
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  await waitFor(() =>
    expect(vi.mocked(loadTickets).mock.lastCall?.[0].values).toMatchObject({
      ...ticketDates('yesterday'),
      status: 'voided',
    }),
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))
  await waitFor(() =>
    expect(vi.mocked(loadTickets).mock.lastCall?.[0].values).toMatchObject(
      ticketDates('week'),
    ),
  )
})
it('valida la captura sin sustituir resultados y restablece fechas, estado, importe y folio', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Filtros de búsqueda' }))
  fireEvent.change(screen.getByLabelText('Folio'), { target: { value: 'xyz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tickets' }))
  expect(screen.getByRole('alert')).toHaveTextContent('al menos 4 caracteres')
  expect(loadTickets).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Folio'), {
    target: { value: 'abcdef00' },
  })
  fireEvent.change(screen.getByLabelText('Importe exacto'), {
    target: { value: '141.50' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tickets' }))
  await waitFor(() =>
    expect(vi.mocked(loadTickets).mock.lastCall?.[0].filters).toMatchObject({
      total: 141.5,
    }),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Restablecer filtros' }),
    ).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }))
  await waitFor(() =>
    expect(vi.mocked(loadTickets).mock.lastCall?.[0].values).toEqual({
      ...ticketDates('today'),
      amount: '',
      folio: '',
      status: 'all',
    }),
  )
})
it('conserva página, filtros y desplazamiento al volver de un ticket', async () => {
  const close = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  const trigger = await screen.findByRole('button', {
    name: 'Ver ticket abcdef01',
  })
  const list = screen.getByRole('region', { name: 'Lista de tickets' })
  list.scrollTop = 210
  fireEvent.click(trigger)
  expect(
    screen.getByRole('dialog', { name: 'Copia de ticket' }),
  ).toHaveTextContent('abcdef01')
  fireEvent.click(screen.getByRole('button', { name: 'Volver a tickets' }))
  expect(list.scrollTop).toBe(210)
  expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
  expect(loadTickets).toHaveBeenCalledTimes(2)
  expect(close).not.toHaveBeenCalled()
})
it('identifica resultados anteriores tras fallo y reintenta la búsqueda pendiente sin paginar datos obsoletos', async () => {
  await setup()
  vi.mocked(loadTickets).mockRejectedValueOnce(new Error('Sin conexión'))
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  await screen.findByText('Mostrando la última búsqueda correcta.')
  expect(
    screen.getByRole('button', { name: 'Ver ticket abcdef00' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(new RegExp(ticketPeriodLabel(ticketDates('today')))),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() =>
    expect(
      screen.queryByText('Mostrando la última búsqueda correcta.'),
    ).not.toBeInTheDocument(),
  )
  expect(vi.mocked(loadTickets).mock.lastCall?.[0].values).toMatchObject(
    ticketDates('yesterday'),
  )
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
