import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InviteUserDialog } from './InviteUserDialog'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
beforeEach(() =>
  invoke.mockReset().mockResolvedValue({ data: {}, error: null }),
)
afterEach(cleanup)

it('protege la invitación durante el envío y permite reintentar con la captura intacta', async () => {
  let reject!: (cause: Error) => void
  invoke.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  const onInvited = vi.fn()
  render(<InviteUserDialog currentUserRole="owner" onInvited={onInvited} />)
  fireEvent.click(screen.getByRole('button', { name: 'Invitar usuario' }))
  fireEvent.change(screen.getByLabelText('Nombre completo'), {
    target: { value: 'Ana Prueba' },
  })
  const email = screen.getByLabelText('Correo')
  fireEvent.change(email, { target: { value: 'qa@example.invalid' } })
  const form = email.closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(email).toBeDisabled()
  expect(screen.getByLabelText('Rol')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: 'Cerrar' }),
  ).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await act(async () => {
    reject(new Error('Sin conexión'))
  })
  expect(email).toHaveValue('qa@example.invalid')
  expect(email).toBeEnabled()
  fireEvent.submit(form)
  await waitFor(() => expect(onInvited).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
})

it('no permite reenviar una invitación confirmada si falla la recarga del equipo', async () => {
  render(
    <InviteUserDialog
      currentUserRole="local_admin"
      onInvited={vi.fn().mockRejectedValue(new Error('503'))}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Invitar usuario' }))
  fireEvent.change(screen.getByLabelText('Nombre completo'), {
    target: { value: 'Ana Prueba' },
  })
  fireEvent.change(screen.getByLabelText('Correo'), {
    target: { value: 'qa@example.invalid' },
  })
  fireEvent.submit(screen.getByLabelText('Correo').closest('form')!)
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(invoke).toHaveBeenCalledTimes(1)
  expect(invoke).toHaveBeenCalledWith('invite-user', {
    body: {
      email: 'qa@example.invalid',
      full_name: 'Ana Prueba',
      role: 'cashier',
    },
  })
})
