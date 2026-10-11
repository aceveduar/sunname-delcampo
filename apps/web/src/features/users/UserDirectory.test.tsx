import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UserDirectory } from './UserDirectory'
import type { Profile } from './useProfiles'

const profiles: Profile[] = Array.from({ length: 26 }, (_, i) => ({
  id: String(i),
  full_name: i === 0 ? 'María López' : i === 25 ? 'José Pérez' : `Usuario ${i}`,
  role: i === 0 ? 'owner' : i === 1 ? 'local_admin' : 'cashier',
  active: i !== 25,
  created_at: '',
  updated_at: '',
  large_text_mode: false,
}))
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function setup(role: Profile['role'] = 'owner', error: string | null = null) {
  const onEdit = vi.fn(),
    onToggle = vi.fn(),
    onRoleChange = vi.fn()
  render(
    <UserDirectory
      profiles={profiles}
      loading={false}
      error={error}
      currentUserId={role === 'owner' ? '0' : '1'}
      currentUserRole={role}
      onEdit={onEdit}
      onToggle={onToggle}
      onRoleChange={onRoleChange}
    />,
  )
  return {
    cards: within(screen.getByLabelText('Tarjetas del equipo')),
    onEdit,
    onToggle,
  }
}
it('busca nombres sin acentos en cualquier orden y conserva las acciones de la tarjeta correcta', () => {
  const { cards, onEdit } = setup()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar usuarios' }), {
    target: { value: 'LOPEZ maria' },
  })
  expect(cards.getAllByRole('article')).toHaveLength(1)
  fireEvent.click(cards.getByRole('button', { name: 'Editar nombre' }))
  expect(onEdit).toHaveBeenCalledWith(profiles[0])
  expect(cards.queryByRole('button', { name: 'Desactivar' })).toBeNull()
  expect(cards.queryByRole('combobox')).toBeNull()
})
it('reinicia la página al cambiar estado y permite recuperar una búsqueda vacía', () => {
  const { cards } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(cards.getByRole('article', { name: 'José Pérez' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Activos/ }))
  expect(cards.queryByRole('article', { name: 'José Pérez' })).toBeNull()
  expect(
    cards.getByRole('article', { name: 'María López' }),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar usuarios' }), {
    target: { value: 'No existe' },
  })
  expect(screen.getByText('No encontramos coincidencias')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
it('el administrador solo puede desactivar cajeros y no recibe selectores de rol', () => {
  const { cards, onToggle } = setup('local_admin')
  expect(cards.queryByRole('combobox')).toBeNull()
  expect(
    within(cards.getByRole('article', { name: 'María López' })).queryByRole(
      'button',
      { name: 'Desactivar' },
    ),
  ).toBeNull()
  expect(
    within(cards.getByRole('article', { name: 'Usuario 1' })).queryByRole(
      'button',
      { name: 'Desactivar' },
    ),
  ).toBeNull()
  fireEvent.click(
    within(cards.getByRole('article', { name: 'Usuario 2' })).getByRole(
      'button',
      { name: 'Desactivar' },
    ),
  )
  expect(onToggle).toHaveBeenCalledWith(profiles[2])
})
it('un error conserva las tarjetas pero bloquea escrituras y no muestra un falso estado vacío', () => {
  const { cards } = setup('owner', 'No se pudo actualizar')
  expect(cards.getAllByRole('article')).toHaveLength(25)
  for (const button of cards.getAllByRole('button'))
    expect(button).toBeDisabled()
  expect(screen.queryByText('No encontramos coincidencias')).toBeNull()
})
