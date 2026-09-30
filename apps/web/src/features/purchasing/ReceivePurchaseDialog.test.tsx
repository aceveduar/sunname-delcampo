import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReceivePurchaseDialog } from './ReceivePurchaseDialog'
import type { PurchaseOrder } from './usePurchaseOrders'

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }))
vi.mock('./usePurchaseDelivery', () => ({
  usePurchaseDelivery: () => ({
    submit,
    busy: false,
    blocked: false,
    pending: null,
    error: null,
  }),
}))
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }))
const order = {
  id: 'order',
  status: 'ordered',
  supplier: { name: 'Proveedor' },
  purchase_order_items: [
    {
      id: 'item',
      quantity: 10,
      received_quantity: 3,
      unit_cost: 1,
      subtotal: 10,
      product: { name: 'Arroz', price: 5, active: true, unit: { code: 'kg' } },
    },
  ],
} as PurchaseOrder
beforeEach(() => {
  submit.mockReset()
  submit.mockResolvedValue(true)
})
afterEach(cleanup)

it('revisa una entrega parcial antes de enviarla y permite corregir cantidades', async () => {
  render(
    <ReceivePurchaseDialog order={order} userId="user" onSaved={vi.fn()} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Recibir' }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar entrega' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByText('Recibir: 2 kg')).toBeInTheDocument()
  expect(screen.getByText('Quedará pendiente: 5 kg')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar cantidades' }))
  expect(screen.getByRole('spinbutton')).toHaveValue(2)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar entrega' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith({
      items: [{ item_id: 'item', quantity: 4 }],
      notes: '',
    }),
  )
})

it('permite cancelar el cierre sin perder las cantidades', async () => {
  render(
    <ReceivePurchaseDialog order={order} userId="user" onSaved={vi.fn()} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Recibir' }))
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(
    screen.getByRole('heading', { name: '¿Descartar la captura?' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(2))
  expect(submit).not.toHaveBeenCalled()
})
