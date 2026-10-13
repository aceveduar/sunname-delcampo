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

const { createCategory, createUnit, toggleActive, resource } = vi.hoisted(
  () => ({
    createCategory: vi.fn(),
    createUnit: vi.fn(),
    toggleActive: vi.fn(),
    resource: { loading: false, error: null as string | null },
  }),
)
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./ProductsTab', () => ({ ProductsTab: () => null }))
vi.mock('./useCategories', () => ({
  useCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Chiles', parent_id: null, active: true },
    ],
    ...resource,
    refresh: vi.fn(),
    createCategory,
    updateCategory: vi.fn(),
    toggleActive,
  }),
}))
vi.mock('./useUnits', () => ({
  useUnits: () => ({
    units: [{ id: 'unit-1', code: 'KG', name: 'Kilogramo', active: true }],
    ...resource,
    refresh: vi.fn(),
    createUnit,
    updateUnit: vi.fn(),
    toggleActive,
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
  toggleActive.mockReset().mockResolvedValue(true)
  resource.loading = false
  resource.error = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Administración del catálogo', () => {
  it('conserva registros tras un error de consulta sin permitir editar ni crear', async () => {
    const { rerender } = render(<CatalogPage role="owner" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Categorías' }))
    await screen.findByRole('button', { name: 'Nueva categoría' })
    resource.error = 'No se pudieron cargar las categorías'
    rerender(<CatalogPage role="owner" />)
    expect(
      screen.getByRole('button', { name: 'Nueva categoría' }),
    ).toBeDisabled()
    const cards = within(screen.getByLabelText('Tarjetas de categorías'))
    expect(cards.getByRole('article', { name: 'Chiles' })).toBeInTheDocument()
    for (const button of cards.getAllByRole('button'))
      expect(button).toBeDisabled()
    expect(screen.queryByText('Aún no hay categorías')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Unidades' }))
    expect(
      await screen.findByRole('button', { name: 'Nueva unidad' }),
    ).toBeDisabled()
  })

  it('bloquea cambios simultáneos y permite reintentar el estado tras un fallo', async () => {
    let finish!: (ok: boolean) => void
    toggleActive.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
    )
    render(<CatalogPage role="owner" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Unidades' }))
    const cards = within(await screen.findByLabelText('Tarjetas de unidades'))
    const toggle = cards.getByRole('button', { name: 'Desactivar Kilogramo' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggleActive).toHaveBeenCalledTimes(1)
    expect(
      cards.getByRole('button', { name: 'Guardando… Kilogramo' }),
    ).toBeDisabled()
    expect(
      cards.getByRole('button', { name: 'Editar Kilogramo' }),
    ).toBeDisabled()
    await act(async () => {
      finish(false)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cambiar el estado',
    )
    fireEvent.click(cards.getByRole('button', { name: 'Desactivar Kilogramo' }))
    await waitFor(() => expect(toggleActive).toHaveBeenCalledTimes(2))
  })

  it('el cajero consulta categorías y unidades sin acciones de escritura', async () => {
    render(<CatalogPage role="cashier" />)
    for (const [tab, text] of [
      ['Categorías', 'Chiles'],
      ['Unidades', 'Kilogramo'],
    ]) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)
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
