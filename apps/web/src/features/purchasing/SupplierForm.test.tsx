import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { SupplierForm } from './SupplierForm'
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
afterEach(cleanup)
it('bloquea envíos y cierres duplicados durante el guardado y conserva valores tras un error', async () => {
  const user = userEvent.setup()
  let finish!: (ok: boolean) => void
  const save = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
  )
  const close = vi.fn()
  render(<SupplierForm supplier={null} onSave={save} onClose={close} />)
  await user.type(screen.getByLabelText('Nombre'), 'distribuidora campo')
  const button = screen.getByRole('button', { name: 'Crear proveedor' })
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  expect(save).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(close).not.toHaveBeenCalled()
  await act(async () => finish(false))
  expect(screen.getByRole('alert')).toHaveTextContent('Tu captura sigue aquí')
  expect(screen.getByLabelText('Nombre')).toHaveValue('distribuidora campo')
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  const confirm = await screen.findByRole('dialog', {
    name: '¿Descartar cambios del proveedor?',
  })
  await user.click(
    within(confirm).getByRole('button', { name: 'Descartar cambios' }),
  )
  expect(close).toHaveBeenCalledTimes(1)
})
