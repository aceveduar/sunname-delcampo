import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CatalogPage } from './CatalogPage'

const { createCategory, createUnit } = vi.hoisted(() => ({
  createCategory: vi.fn(),
  createUnit: vi.fn(),
}))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./ProductsTab', () => ({ ProductsTab: () => null }))
vi.mock('./useCategories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Chiles', parent_id: null, active: true },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createCategory,
    updateCategory: vi.fn(),
    toggleActive: vi.fn(),
  }),
}))
vi.mock('./useUnits', () => ({
  useUnits: () => ({
    units: [{ id: 'unit-1', code: 'KG', name: 'Kilogramo', active: true }],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createUnit,
    updateUnit: vi.fn(),
    toggleActive: vi.fn(),
  }),
}))
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  createCategory.mockReset().mockResolvedValue(true)
  createUnit.mockReset().mockResolvedValue(true)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Administración del catálogo', () => {
  it('el cajero consulta categorías y unidades sin acciones de escritura', async () => {
    render(<CatalogPage role="cashier" />)
    for (const [tab, text] of [
      ['Categorías', 'Chiles'],
      ['Unidades', 'Kilogramo'],
    ]) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      await screen.findByText(text)
      expect(
        screen.queryByRole('button', { name: /Nueva|Editar|Desactivar/ }),
      ).not.toBeInTheDocument()
    }
  })

  it('serializa el alta de categorías y conserva los campos tras una excepción', async () => {
    let reject!: (cause: Error) => void
    createCategory.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail
      }),
    )
    render(<CatalogPage role="owner" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva categoría' }),
    )
    const name = screen.getByLabelText('Nombre')
    fireEvent.change(name, { target: { value: 'Moles' } })
    const form = name.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(createCategory).toHaveBeenCalledTimes(1)
    expect(name).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Cerrar' }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => {
      reject(new Error('503'))
    })
    expect(name).toHaveValue('Moles')
    expect(name).toBeEnabled()
    fireEvent.submit(form)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(createCategory).toHaveBeenCalledTimes(2)
  })

  it('el administrador puede crear una unidad y debe confirmar para descartar su captura', async () => {
    render(<CatalogPage role="local_admin" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Unidades' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva unidad' }))
    fireEvent.change(screen.getByLabelText('Código'), {
      target: { value: 'pza' },
    })
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Pieza' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    const discard = screen.getByRole('dialog', { name: '¿Descartar cambios?' })
    fireEvent.click(within(discard).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: '¿Descartar cambios?' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Código')).toHaveValue('pza')
    fireEvent.submit(screen.getByLabelText('Código').closest('form')!)
    await waitFor(() =>
      expect(createUnit).toHaveBeenCalledWith({ code: 'PZA', name: 'Pieza' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})
