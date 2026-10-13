import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PurchaseOrdersTab } from './PurchaseOrdersTab'
const { resource } = vi.hoisted(() => ({
  resource: { error: null as string | null, loading: false },
}))
vi.mock('./usePurchaseOrders', () => ({
  usePurchaseOrders: () => ({
    ...resource,
    refresh: vi.fn(),
    createOrder: vi.fn().mockResolvedValue(true),
    orders: Array.from({ length: 51 }, (_, i) => ({
      id: 'order-' + i,
      status: 'ordered',
      supplier: { name: 'Proveedor ' + i },
      purchase_order_items: [
        {
          id: 'item-' + i,
          quantity: 10,
          received_quantity: i === 0 ? 2 : 0,
          subtotal: 10,
          unit_cost: 1,
          product: { name: 'Arroz', unit: { code: 'KG' } },
        },
      ],
    })),
  }),
}))
vi.mock('./useSuppliers', () => ({
  useSuppliers: () => ({
    suppliers: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createSupplier: vi.fn(),
  }),
}))
vi.mock('@/features/catalog/useProducts', () => ({
  useProducts: () => ({
    products: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    createProduct: vi.fn(),
  }),
}))
vi.mock('@/features/catalog/useUnits', () => ({
  useUnits: () => ({
    units: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock('./TicketCaptureDialog', () => ({
  TicketCaptureDialog: ({ disabled }: { disabled: boolean }) => (
    <button disabled={disabled}>Capturar por foto</button>
  ),
}))
vi.mock('./NewPurchaseOrderDialog', () => ({
  NewPurchaseOrderDialog: ({
    disabled,
    onCreate,
  }: {
    disabled: boolean
    onCreate: (values: {
      supplierId: string
      notes: null
      items: { productId: string; quantity: number; unitCost: number }[]
    }) => Promise<boolean>
  }) => (
    <button
      disabled={disabled}
      onClick={() =>
        void onCreate({
          supplierId: 's1',
          notes: null,
          items: [{ productId: 'p1', quantity: 1, unitCost: 1 }],
        })
      }
    >
      Nueva orden
    </button>
  ),
}))
vi.mock('./PurchaseOrderDetailDialog', () => ({
  PurchaseOrderDetailDialog: () => null,
}))
vi.mock('./ReceivePurchaseDialog', () => ({
  ReceivePurchaseDialog: ({ disabled }: { disabled: boolean }) => (
    <button disabled={disabled}>Recibir</button>
  ),
}))
beforeEach(() => {
  resource.error = null
  resource.loading = false
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('muestra el conteo correcto y páginas limitadas; los filtros vuelven al inicio sin saltar el scroll', () => {
  render(
    <MemoryRouter>
      <PurchaseOrdersTab userId="user" />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: /Por recibir/ })).toHaveTextContent(
    '51',
  )
  const list = within(screen.getByLabelText('Órdenes de compra'))
  expect(list.getAllByRole('article')).toHaveLength(25)
  const upper = within(
    screen.getByRole('navigation', { name: 'Paginación superior de órdenes' }),
  )
  fireEvent.click(upper.getByRole('button', { name: 'Siguiente' }))
  expect(upper.getByText('26–50 de 51 · página 2 de 3')).toBeInTheDocument()
  vi.mocked(window.scrollTo).mockClear()
  fireEvent.click(screen.getByRole('button', { name: /Por recibir/ }))
  expect(upper.getByText('1–25 de 51 · página 1 de 3')).toBeInTheDocument()
  expect(window.scrollTo).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar órdenes' }), {
    target: { value: 'Proveedor 50' },
  })
  expect(list.getAllByRole('article')).toHaveLength(1)
})
it('conserva órdenes tras un error sin habilitar altas o recepción', () => {
  const { rerender } = render(
    <MemoryRouter>
      <PurchaseOrdersTab userId="user" />
    </MemoryRouter>,
  )
  resource.error = 'No se pudieron cargar las órdenes'
  rerender(
    <MemoryRouter>
      <PurchaseOrdersTab userId="user" />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Nueva orden' })).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Capturar por foto' }),
  ).toBeDisabled()
  for (const button of screen.getAllByRole('button', { name: 'Recibir' }))
    expect(button).toBeDisabled()
  expect(
    screen.getByText(
      'Mostrando la última consulta correcta. Actualiza antes de recibir mercancía.',
    ),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('navigation', {
      name: 'Paginación superior de órdenes',
    }),
  ).not.toBeInTheDocument()
})

it('limpia filtros tras confirmar un alta para mostrar la compra en el listado inicial', async () => {
  render(
    <MemoryRouter>
      <PurchaseOrdersTab userId="user" />
    </MemoryRouter>,
  )
  const search = screen.getByRole('textbox', { name: 'Buscar órdenes' })
  fireEvent.change(search, { target: { value: 'Proveedor 50' } })
  expect(
    within(screen.getByLabelText('Órdenes de compra')).getAllByRole('article'),
  ).toHaveLength(1)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Nueva orden' }))
  })
  expect(search).toHaveValue('')
  expect(
    within(screen.getByLabelText('Órdenes de compra')).getAllByRole('article'),
  ).toHaveLength(25)
  expect(
    within(
      screen.getByRole('navigation', {
        name: 'Paginación superior de órdenes',
      }),
    ).getByText('1–25 de 51 · página 1 de 3'),
  ).toBeInTheDocument()
})
