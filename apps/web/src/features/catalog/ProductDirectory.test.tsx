import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProductDirectory, type ProductView } from './ProductDirectory'
import type { Product } from './useProducts'

beforeEach(() => {
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
const products = [
  {
    id: 'a',
    name: 'Anís',
    active: true,
    price: 0,
    sold_by_weight: true,
    price_per_100g: 13,
    sku: null,
    category_id: null,
    unit_id: 'u',
  },
  {
    id: 'b',
    name: 'Almendra',
    active: false,
    price: 0,
    sold_by_weight: true,
    price_per_100g: 0,
    sku: null,
    category_id: null,
    unit_id: 'u',
  },
  {
    id: 'c',
    name: 'Arroz',
    active: true,
    price: 28,
    sold_by_weight: true,
    price_per_100g: 5,
    sku: null,
    category_id: null,
    unit_id: 'u',
  },
  {
    id: 'd',
    name: 'Chile',
    active: true,
    price: 120,
    sold_by_weight: true,
    price_per_100g: null,
    sku: null,
    category_id: null,
    unit_id: 'u',
  },
] as Product[]

it.each(['cards', 'table'] as ProductView[])(
  'distingue tarifas pendientes y vigentes sin ocultar la alerta de un activo sin precio en %s',
  (view) => {
    render(
      <ProductDirectory
        products={products}
        view={view}
        loading={false}
        error={null}
        hasFilters={false}
        categoryName={() => 'Sin categoría'}
        unitCode={() => 'KG'}
        costsById={new Map()}
        actions={() => <button>Editar</button>}
      />,
    )
    const directory = within(
      screen.getByLabelText(
        view === 'cards' ? 'Tarjetas de productos' : 'Tabla de productos',
      ),
    )
    expect(directory.queryByText('$0.00')).not.toBeInTheDocument()
    expect(directory.getAllByText('Sin precio', { exact: true })).toHaveLength(
      2,
    )
    const noPrices = within(
      directory
        .getByText('Almendra')
        .closest(view === 'cards' ? 'article' : 'tr')!,
    )
    expect(noPrices.queryByText('Sin precio por 100 g')).not.toBeInTheDocument()
    expect(directory.getByText('Sin precio por 100 g')).toBeInTheDocument()
    expect(directory.getByText('Activo sin precio')).toBeInTheDocument()
    expect(directory.getByText('$13.00 / 100 g')).toBeInTheDocument()
    expect(directory.getByText('$28.00')).toBeInTheDocument()
  },
)

it('monta una sola presentación y responde al cambio de ancho sin perder productos', () => {
  let matches = true
  const listeners = new Set<() => void>()
  const remove = vi.fn((_: string, listener: () => void) =>
    listeners.delete(listener),
  )
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches
      },
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: remove,
    })),
  )
  const catalog = Array.from({ length: 25 }, (_, i) => ({
    ...products[2],
    id: String(i),
    name: 'Producto ' + i,
    image_url: 'https://qa.invalid/' + i,
  }))
  const actions = vi.fn((product: Product) => (
    <button>Editar {product.id}</button>
  ))
  const props = {
    products: catalog,
    view: 'table' as const,
    loading: false,
    error: null,
    hasFilters: false,
    categoryName: () => 'Sin categoría',
    unitCode: () => 'KG',
    costsById: new Map(),
    actions,
  }
  const { container, rerender, unmount } = render(
    <ProductDirectory {...props} />,
  )
  expect(screen.getByLabelText('Tabla de productos')).toBeInTheDocument()
  expect(screen.queryByLabelText('Tarjetas de productos')).toBeNull()
  expect(container.querySelectorAll('img')).toHaveLength(25)
  expect(actions).toHaveBeenCalledTimes(25)
  act(() => {
    matches = false
    listeners.forEach((notify) => notify())
  })
  expect(screen.getByLabelText('Tarjetas de productos')).toBeInTheDocument()
  expect(screen.queryByLabelText('Tabla de productos')).toBeNull()
  expect(screen.getAllByRole('article')).toHaveLength(25)
  expect(container.querySelectorAll('img')).toHaveLength(25)
  act(() => {
    matches = true
    listeners.forEach((notify) => notify())
  })
  rerender(<ProductDirectory {...props} view="cards" />)
  expect(screen.queryByLabelText('Tabla de productos')).toBeNull()
  expect(screen.getAllByRole('article')).toHaveLength(25)
  unmount()
  expect(listeners.size).toBe(0)
  expect(remove).toHaveBeenCalled()
})
