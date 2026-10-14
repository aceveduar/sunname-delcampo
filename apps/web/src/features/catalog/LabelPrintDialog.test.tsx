import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Product } from './useProducts'
import { LabelPrintDialog } from './LabelPrintDialog'

const state = vi.hoisted(() => ({ fail: false }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('./LabelPrintContent', () => ({
  LabelPrintContent: ({ product }: { product: Product }) => {
    if (state.fail) throw new Error('Carga interrumpida')
    return <p>Etiqueta de {product.name}</p>
  },
}))
afterEach(() => {
  cleanup()
  state.fail = false
  vi.restoreAllMocks()
})
const product = { id: 'p1', name: 'Café' } as Product

it('no monta contenido sin selección y carga la etiqueta al solicitarla', async () => {
  const onOpenChange = vi.fn()
  const props = {
    product: null as Product | null,
    onOpenChange,
    onAssignSku: vi.fn(),
  }
  const { rerender } = render(<LabelPrintDialog {...props} />)
  expect(screen.queryByText('Etiqueta de Café')).toBeNull()
  rerender(<LabelPrintDialog {...props} product={product} />)
  expect(await screen.findByText('Etiqueta de Café')).toBeInTheDocument()
  rerender(<LabelPrintDialog {...props} />)
  expect(screen.queryByText('Etiqueta de Café')).toBeNull()
})

it('permite cancelar o reintentar un fallo sin perder la selección', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.fail = true
  const onOpenChange = vi.fn()
  render(
    <LabelPrintDialog
      product={product}
      onOpenChange={onOpenChange}
      onAssignSku={vi.fn()}
    />,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo cargar',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  state.fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Etiqueta de Café')).toBeInTheDocument()
})
