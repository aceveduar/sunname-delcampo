import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CatalogReferenceDirectory } from './CatalogReferenceDirectory'
import type { UnitOfMeasure } from './useUnits'

const units: UnitOfMeasure[] = Array.from({ length: 26 }, (_, i) => ({
  id: String(i),
  name: i === 0 ? 'Kilográmo' : `Unidad ${i}`,
  code: i === 0 ? 'KG' : `U${i}`,
  active: i !== 25,
}))
const unitCode = (unit: UnitOfMeasure) => unit.code
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
function setup(error: string | null = null, canManage = true) {
  const onEdit = vi.fn(),
    onToggle = vi.fn()
  render(
    <CatalogReferenceDirectory
      items={units}
      singular="unidad"
      plural="unidades"
      detailLabel="Código"
      detailValue={unitCode}
      searchPlaceholder="Buscar por nombre o código"
      loading={false}
      error={error}
      canManage={canManage}
      pendingId={null}
      onEdit={onEdit}
      onToggle={onToggle}
    />,
  )
  return {
    cards: within(screen.getByLabelText('Tarjetas de unidades')),
    onEdit,
    onToggle,
  }
}
it('encuentra unidades por código o nombre sin acentos y edita la tarjeta correcta', () => {
  const { cards, onEdit } = setup()
  for (const value of ['kg', 'KILOGRAMO']) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar unidades' }), {
      target: { value },
    })
    expect(cards.getAllByRole('article')).toHaveLength(1)
    expect(
      cards.getByRole('article', { name: 'Kilográmo' }),
    ).toBeInTheDocument()
  }
  expect(window.scrollTo).not.toHaveBeenCalled()
  fireEvent.click(cards.getByRole('button', { name: 'Editar Kilográmo' }))
  expect(onEdit).toHaveBeenCalledWith(units[0])
})
it('filtrar reinicia la página y limpiar restaura la lista sin resultados', () => {
  const { cards } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(cards.getByRole('article', { name: 'Unidad 25' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Activas/ }))
  expect(cards.getAllByRole('article')).toHaveLength(25)
  expect(cards.queryByRole('article', { name: 'Unidad 25' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar unidades' }), {
    target: { value: 'sin coincidencias' },
  })
  expect(screen.getByText('No encontramos coincidencias')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
it('un fallo mantiene la última consulta y bloquea sus acciones; un lector no recibe acciones', () => {
  const { cards } = setup('Sin conexión')
  expect(
    screen.getByText(/Mostrando la última consulta correcta/),
  ).toBeInTheDocument()
  for (const button of cards.getAllByRole('button'))
    expect(button).toBeDisabled()
  cleanup()
  const readOnly = setup(null, false)
  expect(readOnly.cards.queryByRole('button')).toBeNull()
})
