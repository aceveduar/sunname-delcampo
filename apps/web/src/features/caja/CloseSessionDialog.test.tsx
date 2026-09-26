import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CloseSessionDialog } from './CloseSessionDialog'
const { fetchCashBalance } = vi.hoisted(() => ({ fetchCashBalance: vi.fn() }))
vi.mock('./cashBalance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cashBalance')>()),
  fetchCashBalance,
}))
beforeEach(() => {
  fetchCashBalance.mockReset()
  fetchCashBalance.mockResolvedValue({
    openingAmount: 100,
    cashSales: 50,
    expectedAmount: 150,
  })
})
afterEach(cleanup)
it('exige observación para un descuadre y conserva el contado si cambia el balance', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn().mockResolvedValue(true)
  render(<CloseSessionDialog sessionId="session" onClose={onClose} />)
  await user.click(screen.getByRole('button', { name: 'Cerrar caja' }))
  await screen.findByText('Efectivo esperado')
  fireEvent.change(screen.getByLabelText('Efectivo contado'), {
    target: { value: '140' },
  })
  expect(
    screen.getByRole('button', { name: 'Confirmar cierre' }),
  ).toBeDisabled()
  await user.type(
    screen.getByLabelText(/Observación del descuadre/),
    'Revisado',
  )
  fetchCashBalance.mockResolvedValue({
    openingAmount: 100,
    cashSales: 60,
    expectedAmount: 160,
  })
  await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
  await screen.findByText(/El efectivo esperado cambió/)
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Efectivo contado')).toHaveValue(140)
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirmar cierre' }),
    ).toBeEnabled(),
  )
  await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
  await waitFor(() =>
    expect(onClose).toHaveBeenCalledWith(140, 'Revisado', 160),
  )
})
it('impide cerrar si falla el cálculo y permite reintentar', async () => {
  const user = userEvent.setup()
  fetchCashBalance.mockRejectedValueOnce(new Error('network'))
  render(<CloseSessionDialog sessionId="session" onClose={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Cerrar caja' }))
  await screen.findByText(/No se pudo consultar/)
  expect(
    screen.getByRole('button', { name: 'Confirmar cierre' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByText('Efectivo esperado')
})

it('no permite abrir el cierre mientras hay una venta pendiente', async () => {
  const user = userEvent.setup()
  render(<CloseSessionDialog sessionId="session" disabled onClose={vi.fn()} />)
  const trigger = screen.getByRole('button', { name: 'Cerrar caja' })
  expect(trigger).toBeDisabled()
  await user.click(trigger)
  expect(fetchCashBalance).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
