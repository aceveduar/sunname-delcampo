import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BillingPage } from './BillingPage'
import { BillingSessionDialog } from './BillingSessionDialog'
import {
  loadBillableSession,
  loadBillableSessions,
  requestBillingInvoice,
  type BillableSession,
  type BillingQuery,
} from './billingData'

vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./billingData', async (original) => ({
  ...(await original<typeof import('./billingData')>()),
  loadBillableSession: vi.fn(),
  loadBillableSessions: vi.fn(),
  requestBillingInvoice: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/features/settings/useTenantFiscalSettings', () => ({
  useTenantFiscalSettings: () => ({
    loading: false,
    error: null,
    isComplete: true,
  }),
}))
const row: BillableSession = {
  cashSessionId: '12345678-0000-4000-8000-000000000000',
  closedAt: '2026-10-11T12:00:00Z',
  closedBy: 'Ana',
  cashCounted: 800,
  salesTotal: 1200,
  saleCount: 10,
  invoice: null,
}
const invoice = {
  id: 'invoice',
  status: 'pending' as const,
  total: 1250,
  requested_at: '2026-10-11T13:00:00Z',
  error_message: null,
  uuid_fiscal: null,
}
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.mocked(loadBillableSession).mockReset().mockResolvedValue(row)
  vi.mocked(loadBillableSessions)
    .mockReset()
    .mockImplementation(async (query: BillingQuery) => ({
      rows: [row],
      count: 21,
      page: query.page,
      query,
    }))
  vi.mocked(requestBillingInvoice).mockReset().mockResolvedValue(invoice)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('un error inicial ofrece reintento sin afirmar que no hay cortes', async () => {
  vi.mocked(loadBillableSessions).mockRejectedValueOnce(new Error('503'))
  render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  )
  await screen.findByRole('alert')
  expect(screen.queryByText('Sin cortes con estos filtros')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('21 cortes encontrados.')
  expect(screen.queryByRole('alert')).toBeNull()
})
it('conserva la consulta anterior al fallar filtros y no deja operar con datos desactualizados', async () => {
  render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  )
  await screen.findByText('21 cortes encontrados.')
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  await waitFor(() =>
    expect(loadBillableSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Aplicar filtros' }),
    ).toBeEnabled(),
  )
  vi.mocked(loadBillableSessions).mockRejectedValueOnce(new Error('503'))
  fireEvent.change(screen.getByLabelText('Desde (fecha de cierre)'), {
    target: { value: '2026-10-01' },
  })
  fireEvent.change(screen.getByLabelText('Hasta'), {
    target: { value: '2026-10-11' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
  await screen.findByRole('alert')
  expect(loadBillableSessions).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 0 }),
  )
  expect(screen.getByText(/Todo el historial de cierres/)).toBeInTheDocument()
  expect(
    screen.getByText('Mostrando la última consulta correcta.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
  for (const button of screen.getAllByRole('button', { name: /Revisar corte/ }))
    expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText(/Cierres del 2026-10-01 al 2026-10-11/)
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
it('distingue el total guardado del efectivo y muestra el error de una solicitud', async () => {
  vi.mocked(loadBillableSession).mockResolvedValue({
    ...row,
    invoice: {
      ...invoice,
      status: 'error',
      error_message: 'El proveedor rechazó la solicitud de prueba.',
    },
  })
  render(
    <BillingSessionDialog
      sessionId={row.cashSessionId}
      canRequest
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  )
  const dialog = within(screen.getByRole('dialog'))
  await dialog.findByText('$1,250.00')
  expect(dialog.getByText('$800.00')).toBeInTheDocument()
  expect(dialog.getByText('$1,200.00')).toBeInTheDocument()
  expect(dialog.getByRole('alert')).toHaveTextContent('El proveedor rechazó')
  expect(
    dialog.queryByRole('button', { name: 'Registrar solicitud' }),
  ).toBeNull()
})
it('impide dobles envíos y cierre pendiente y después muestra el total real de la solicitud', async () => {
  let finish!: (value: typeof invoice) => void
  vi.mocked(requestBillingInvoice).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const onClose = vi.fn(),
    onChanged = vi.fn().mockResolvedValue(undefined)
  render(
    <BillingSessionDialog
      sessionId={row.cashSessionId}
      canRequest
      onClose={onClose}
      onChanged={onChanged}
    />,
  )
  const submit = await screen.findByRole('button', {
    name: 'Registrar solicitud',
  })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(requestBillingInvoice).toHaveBeenCalledTimes(1)
  expect(submit).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Actualizar detalle' }),
  ).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => {
    finish(invoice)
  })
  expect(await screen.findByText('$1,250.00')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Registrar solicitud' }),
  ).toBeNull()
  expect(onChanged).toHaveBeenCalledTimes(1)
})
it('bloquea solicitudes sin datos fiscales o tras un fallo de lectura del detalle', async () => {
  const { rerender } = render(
    <BillingSessionDialog
      sessionId={row.cashSessionId}
      canRequest={false}
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  )
  expect(
    await screen.findByRole('button', { name: 'Registrar solicitud' }),
  ).toBeDisabled()
  rerender(
    <BillingSessionDialog
      sessionId={row.cashSessionId}
      canRequest
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  )
  vi.mocked(loadBillableSession).mockRejectedValueOnce(new Error('503'))
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar detalle' }))
  await screen.findByRole('alert')
  expect(
    screen.getByRole('button', { name: 'Registrar solicitud' }),
  ).toBeDisabled()
  expect(requestBillingInvoice).not.toHaveBeenCalled()
})
