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
import { SalesHistory } from './SalesHistory'
import { useSales } from './useSales'
vi.mock('./useSales', () => ({ useSales: vi.fn(), SALES_PAGE_SIZE: 25 }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const voidSale = vi.fn()
const range = { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' }
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    },
  )
  vi.clearAllMocks()
  voidSale.mockResolvedValue(true)
  vi.mocked(useSales).mockImplementation((query) => ({
    query,
    page: query.page,
    count: 61,
    current: true,
    error: null,
    loading: false,
    updatedAt: new Date(),
    refresh: vi.fn().mockResolvedValue(undefined),
    setData: vi.fn(),
    voidSale,
    sales: [
      {
        id: 'abcdef12-0000-4000-8000-000000000000',
        total: 25,
        createdAt: range.from,
        status: 'completed',
        soldBy: 'María',
      },
    ],
  }))
})
function setup() {
  const onVoided = vi.fn().mockResolvedValue(undefined)
  const onMutationChange = vi.fn()
  render(
    <SalesHistory
      range={range}
      revision={0}
      onVoided={onVoided}
      onMutationChange={onMutationChange}
      renderReceipt={(id, close) => (
        <div role="dialog" aria-label="Ticket">
          <p>{id}</p>
          <button onClick={close}>Cerrar ticket</button>
        </div>
      )}
    />,
  )
  return { onVoided, onMutationChange }
}
it('pagina, reinicia al cambiar filtros y aplica el folio solo después de validarlo', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(vi.mocked(useSales).mock.lastCall?.[0].page).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'Anuladas' }))
  expect(vi.mocked(useSales).mock.lastCall?.[0]).toMatchObject({
    page: 1,
    status: 'voided',
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar por folio' }), {
    target: { value: 'xyz' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar folio' }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Escribe al menos 4 caracteres',
  )
  expect(vi.mocked(useSales).mock.lastCall?.[0].folio).toBe('')
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar por folio' }), {
    target: { value: 'abcdef12' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar folio' }))
  expect(vi.mocked(useSales).mock.lastCall?.[0].folio).toBe('abcdef12')
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(vi.mocked(useSales).mock.lastCall?.[0]).toMatchObject({
    page: 1,
    status: 'all',
    folio: '',
  })
})
it('abre el ticket solicitado y conserva el listado', () => {
  setup()
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver ticket' })[0])
  expect(screen.getByRole('dialog', { name: 'Ticket' })).toHaveTextContent(
    'abcdef12',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar ticket' }))
  expect(
    screen.queryByRole('dialog', { name: 'Ticket' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
})
it('confirma la anulación una sola vez y actualiza el resumen al completarse', async () => {
  let finish!: (value: boolean) => void
  voidSale.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
  )
  const callbacks = setup()
  fireEvent.click(screen.getAllByRole('button', { name: 'Anular' })[0])
  const dialog = await screen.findByRole('dialog', { name: 'Anular venta' })
  expect(dialog).toHaveTextContent('abcdef12')
  const confirm = within(dialog).getByRole('button', { name: 'Anular venta' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(voidSale).toHaveBeenCalledTimes(1)
  expect(callbacks.onMutationChange).toHaveBeenCalledWith(true)
  expect(
    within(dialog).getByRole('button', { name: 'Anulando…' }),
  ).toBeDisabled()
  await act(async () => finish(true))
  await waitFor(() => expect(callbacks.onVoided).toHaveBeenCalledTimes(1))
  expect(callbacks.onMutationChange).toHaveBeenLastCalledWith(false)
})
