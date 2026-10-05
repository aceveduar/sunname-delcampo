import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CustomerForm } from './CustomerForm'
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
afterEach(cleanup)
it('evita envíos repetidos y bloquea el cierre durante el guardado', async () => {
  let finish!: (saved: boolean) => void
  const onSave = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
  )
  const onClose = vi.fn()
  render(<CustomerForm customer={null} onSave={onSave} onClose={onClose} />)
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'María López' },
  })
  fireEvent.submit(document.querySelector('form')!)
  fireEvent.submit(document.querySelector('form')!)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => finish(true))
  expect(onClose).toHaveBeenCalledTimes(1)
})
it('conserva la captura al fallar y pide confirmar antes de descartarla', async () => {
  const onClose = vi.fn()
  render(
    <CustomerForm
      customer={null}
      onSave={vi.fn().mockResolvedValue(false)}
      onClose={onClose}
    />,
  )
  fireEvent.change(screen.getByLabelText('Nombre'), {
    target: { value: 'María López' },
  })
  fireEvent.submit(document.querySelector('form')!)
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tu captura sigue aquí',
    ),
  )
  expect(screen.getByLabelText('Nombre')).toHaveValue('María López')
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onClose).not.toHaveBeenCalled()
  expect(
    await screen.findByRole('dialog', {
      name: '¿Descartar cambios del cliente?',
    }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})
