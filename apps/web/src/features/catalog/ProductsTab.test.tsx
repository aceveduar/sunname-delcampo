import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProductsTab } from './ProductsTab'

const { toggleActive, deleteProduct, useCosts, resource } = vi.hoisted(() => ({
  toggleActive: vi.fn(),
  deleteProduct: vi.fn(),
  useCosts: vi.fn(),
  resource: { loading: false, error: null as string | null },
}))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./useProducts', () => ({
  useProducts: () => ({
    products: [
      {
        id: 'p1',
        name: 'Chile ancho',
        price: 220,
        sku: 'CH1',
        active: true,
        unit_id: 'u1',
        category_id: null,
        sold_by_weight: true,
        price_per_100g: 26,
      },
    ],
    ...resource,
    refresh: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    updatePrices: vi.fn(),
    toggleActive,
    deleteProduct,
    fetchCost: vi.fn(),
  }),
}))
vi.mock('./useProductCosts', () => ({ useProductCosts: useCosts }))
vi.mock('./useCategories', () => ({
  NO_CATEGORY: '__none__',
  useCategories: () => ({
    categories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('./useUnits', () => ({
  useUnits: () => ({
    units: [{ id: 'u1', code: 'KG', name: 'Kilogramo', active: true }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('./ProductForm', () => ({ ProductForm: () => null }))
vi.mock('./PriceSheetDialog', () => ({ PriceSheetDialog: () => null }))
vi.mock('./LabelPrintDialog', () => ({ LabelPrintDialog: () => null }))
vi.mock('./StockAdjustDialog', () => ({ StockAdjustDialog: () => null }))
vi.mock('@/components/BarcodeScannerDialog', () => ({
  BarcodeScannerDialog: () => null,
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
  toggleActive.mockReset().mockResolvedValue(true)
  deleteProduct.mockReset().mockResolvedValue(true)
  useCosts.mockReset().mockReturnValue({
    costsById: new Map(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  })
  resource.loading = false
  resource.error = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
async function openActions() {
  const cards = within(screen.getByLabelText('Tarjetas de productos'))
  fireEvent.click(
    cards.getByRole('button', { name: 'Más acciones de Chile ancho' }),
  )
  return await screen.findByRole('menu')
}

it('conserva productos tras un error y bloquea las acciones hasta recuperar la consulta', () => {
  const { rerender } = render(<ProductsTab role="owner" />)
  resource.error = 'No se pudieron cargar los productos'
  rerender(<ProductsTab role="owner" />)
  expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Precios' })).toBeDisabled()
  const cards = within(screen.getByLabelText('Tarjetas de productos'))
  expect(
    cards.getByRole('article', { name: 'Chile ancho' }),
  ).toBeInTheDocument()
  for (const button of cards.getAllByRole('button'))
    expect(button).toBeDisabled()
  resource.error = null
  rerender(<ProductsTab role="owner" />)
  expect(
    cards.getByRole('button', { name: 'Editar Chile ancho' }),
  ).toBeEnabled()
})

it('serializa el cambio de estado y permite reintentar una excepción', async () => {
  let reject!: (error: Error) => void
  toggleActive.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  render(<ProductsTab role="owner" />)
  const menu = await openActions()
  const deactivate = within(menu).getByRole('menuitem', {
    name: 'Desactivar producto',
  })
  fireEvent.click(deactivate)
  fireEvent.click(deactivate)
  expect(toggleActive).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeDisabled()
  await act(async () => {
    reject(new Error('503'))
  })
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No se pudo completar la acción',
  )
  const retry = await openActions()
  fireEvent.click(
    within(retry).getByRole('menuitem', { name: 'Desactivar producto' }),
  )
  await waitFor(() => expect(toggleActive).toHaveBeenCalledTimes(2))
})

it('no cierra ni duplica un borrado pendiente y conserva el producto para reintentar', async () => {
  let finish!: (ok: boolean) => void
  deleteProduct.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve
    }),
  )
  render(<ProductsTab role="owner" />)
  const menu = await openActions()
  fireEvent.click(
    within(menu).getByRole('menuitem', { name: 'Borrar producto' }),
  )
  const dialog = await screen.findByRole('dialog', { name: 'Borrar producto' })
  const confirm = within(dialog).getByRole('button', {
    name: 'Borrar',
  })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(deleteProduct).toHaveBeenCalledOnce()
  expect(
    within(dialog).getByRole('button', { name: 'Cancelar' }),
  ).toBeDisabled()
  expect(dialog).toBeInTheDocument()
  await act(async () => {
    finish(false)
  })
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'No se pudo completar',
  )
  expect(dialog).toHaveTextContent('Chile ancho')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(deleteProduct).toHaveBeenCalledTimes(2)
})

it('el cajero consulta el catálogo sin costos ni acciones de administración', () => {
  render(<ProductsTab role="cashier" />)
  expect(useCosts).toHaveBeenCalledWith(false)
  expect(
    screen.getByRole('article', { name: 'Chile ancho' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /Nuevo producto|Precios|Editar Chile|Más acciones/,
    }),
  ).not.toBeInTheDocument()
})
