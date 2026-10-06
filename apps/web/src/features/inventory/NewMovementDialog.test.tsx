import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NewMovementDialog } from './NewMovementDialog'
import type { StockRow } from './useInventoryStock'
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
afterEach(cleanup)
const row = {
  product: { id: 'a', name: 'Chile Ancho', sku: 'CH-1', unit_id: 'kg' },
  quantityOnHand: 5.5,
} as StockRow
async function open(
  onRegister: (values: unknown) => Promise<boolean>,
  locked = true,
) {
  render(
    <NewMovementDialog
      triggerLabel="Nuevo movimiento"
      rows={[row]}
      unitCode={() => 'KG'}
      initialProductId={locked ? 'a' : undefined}
      onRegister={onRegister}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo movimiento' }))
  return screen.findByRole('dialog', { name: 'Registrar movimiento' })
}
it('muestra la resta estimada, envía el delta una sola vez y bloquea el cierre mientras guarda', async () => {
  let finish!: (value: boolean) => void
  const save = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
  )
  const dialog = await open(save)
  fireEvent.click(screen.getByRole('button', { name: 'Ajuste −' }))
  fireEvent.change(screen.getByLabelText('Cantidad a restar (KG)'), {
    target: { value: '1.125' },
  })
  expect(screen.getByText('4.375 KG')).toBeInTheDocument()
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.submit(dialog.querySelector('form')!)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith({
    productId: 'a',
    type: 'adjustment',
    quantity: -1.125,
    notes: null,
  })
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(
    screen.getByRole('dialog', { name: 'Registrar movimiento' }),
  ).toBeInTheDocument()
  await act(async () => finish(true))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Registrar movimiento' }),
    ).not.toBeInTheDocument(),
  )
})
it('conserva cantidad y motivo tras un fallo y confirma el descarte', async () => {
  const dialog = await open(vi.fn().mockResolvedValue(false))
  fireEvent.change(screen.getByLabelText('Cantidad a sumar (KG)'), {
    target: { value: '2.25' },
  })
  fireEvent.change(screen.getByLabelText('Motivo (opcional)'), {
    target: { value: 'Conteo físico' },
  })
  fireEvent.submit(dialog.querySelector('form')!)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Tu captura sigue aquí',
  )
  expect(screen.getByLabelText('Cantidad a sumar (KG)')).toHaveValue(2.25)
  expect(screen.getByLabelText('Motivo (opcional)')).toHaveValue(
    'Conteo físico',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  const confirmation = await screen.findByRole('dialog', {
    name: '¿Descartar el movimiento?',
  })
  fireEvent.click(
    within(confirmation).getByRole('button', { name: 'Descartar captura' }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Registrar movimiento' }),
    ).not.toBeInTheDocument(),
  )
})
it('permite seleccionar por código y no registra al pulsar Enter en la búsqueda', async () => {
  const save = vi.fn().mockResolvedValue(true)
  await open(save, false)
  const input = screen.getByRole('textbox', {
    name: 'Buscar producto por nombre o código',
  })
  fireEvent.change(input, { target: { value: 'CH-1' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(
    within(
      screen.getByRole('list', { name: 'Productos para el movimiento' }),
    ).getByRole('button'),
  )
  fireEvent.change(screen.getByLabelText('Cantidad a sumar (KG)'), {
    target: { value: '0.0001' },
  })
  fireEvent.submit(document.querySelector('form')!)
  expect(save).not.toHaveBeenCalled()
  expect(
    screen.getByRole('button', { name: 'Registrar movimiento' }),
  ).toBeDisabled()
})
