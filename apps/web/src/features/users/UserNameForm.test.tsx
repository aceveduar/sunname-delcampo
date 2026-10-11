import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { UserNameForm } from './UserNameForm'
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
afterEach(cleanup)

it('conserva el nombre ante un error y bloquea envíos y cierre durante el guardado', async () => {
  let finish!: (ok: boolean) => void
  const onSave = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
    )
    .mockResolvedValue(true)
  const onClose = vi.fn()
  render(<UserNameForm initialName="Ana" onSave={onSave} onClose={onClose} />)
  const name = screen.getByLabelText('Nombre completo')
  fireEvent.change(name, { target: { value: 'Ana María' } })
  fireEvent.submit(name.closest('form')!)
  fireEvent.submit(name.closest('form')!)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(name).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => {
    finish(false)
  })
  expect(name).toHaveValue('Ana María')
  expect(name).toBeEnabled()
  fireEvent.submit(name.closest('form')!)
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})
