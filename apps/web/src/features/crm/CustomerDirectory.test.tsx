import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CustomerDirectory } from './CustomerDirectory'
import type { Customer } from './useCustomers'

const customers: Customer[] = Array.from({ length: 26 }, (_, index) => ({
  id: String(index),
  name:
    index === 0
      ? 'María López'
      : index === 25
        ? 'José Pérez'
        : 'Cliente ' + index,
  active: index !== 25,
  email: index === 0 ? 'maria@example.com' : null,
  phone: index === 0 ? '(55) 1234-5678' : null,
  notes: null,
  created_at: '2026-10-03T12:00:00Z',
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

function renderDirectory() {
  const onEdit = vi.fn()
  render(
    <CustomerDirectory
      customers={customers}
      loading={false}
      error={null}
      onEdit={onEdit}
      onToggle={vi.fn()}
    />,
  )
  return { table: within(screen.getByRole('table')), onEdit }
}

it('encuentra nombres sin acentos y teléfonos sin formato conservando la acción del cliente', () => {
  const { table, onEdit } = renderDirectory()
  const search = screen.getByRole('textbox', { name: 'Buscar clientes' })
  for (const value of ['maria', '5512345678', 'MARIA@EXAMPLE.COM']) {
    fireEvent.change(search, { target: { value } })
    expect(table.getAllByRole('row')).toHaveLength(2)
    expect(table.getByText('María López')).toBeInTheDocument()
  }
  fireEvent.click(table.getByRole('button', { name: 'Editar' }))
  expect(onEdit).toHaveBeenCalledWith(customers[0])
})

it('reinicia la página al filtrar por estado y permite limpiar una búsqueda sin resultados', () => {
  const { table } = renderDirectory()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(table.getByText('José Pérez')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Activos/ }))
  expect(table.getByText('María López')).toBeInTheDocument()
  expect(table.queryByText('José Pérez')).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar clientes' }), {
    target: { value: 'inexistente' },
  })
  expect(screen.getByText('No encontramos coincidencias')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(screen.getByRole('button', { name: /^Todos/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
