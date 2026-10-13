import { cleanup, render, screen, within } from '@testing-library/react'
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
    expect(directory.getByText('Sin precio por 100 g')).toBeInTheDocument()
    expect(directory.getByText('Activo sin precio')).toBeInTheDocument()
    expect(directory.getByText('$13.00 / 100 g')).toBeInTheDocument()
    expect(directory.getByText('$28.00')).toBeInTheDocument()
  },
)
