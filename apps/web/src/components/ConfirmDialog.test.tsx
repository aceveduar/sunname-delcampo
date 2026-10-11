import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
afterEach(cleanup)

it('no permite cerrar una confirmación mientras la operación está pendiente', () => {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn()
  const props = {
    open: true,
    onOpenChange,
    onConfirm,
    title: 'Cambiar rol',
    description: 'Confirmar cambio de acceso',
  }
  const view = render(<ConfirmDialog {...props} confirming />)
  expect(
    screen.queryByRole('button', { name: 'Cerrar' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onOpenChange).not.toHaveBeenCalled()
  view.rerender(<ConfirmDialog {...props} confirming={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
