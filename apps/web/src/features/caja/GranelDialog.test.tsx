import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GranelDialog } from './GranelDialog'
import type { Product } from '@/features/catalog/useProducts'
const product = {
  id: 'chile',
  name: 'Chile',
  price: 160,
  price_per_100g: 19,
} as Product
afterEach(cleanup)
it('convierte gramos a kilos sin cambiar el peso y confirma con tarifa de cuarto', () => {
  const confirm = vi.fn()
  render(
    <GranelDialog
      product={product}
      initialGrams={250}
      onConfirm={confirm}
      onOpenChange={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByRole('combobox', { name: 'Unidad de peso' }), {
    target: { value: 'kg' },
  })
  expect(screen.getByLabelText('Peso de la báscula (kg)')).toHaveValue(0.25)
  fireEvent.click(
    screen.getByRole('button', { name: 'Agregar 250 g · $40.00' }),
  )
  expect(confirm).toHaveBeenCalledWith(0.25, undefined)
})
it('edita por monto conservando el importe exacto y cancelar no confirma', () => {
  const confirm = vi.fn(),
    close = vi.fn()
  render(
    <GranelDialog
      product={product}
      initialAmount={20}
      initialGrams={105}
      editing
      onConfirm={confirm}
      onOpenChange={close}
    />,
  )
  expect(screen.getByLabelText('Monto pedido por el cliente')).toHaveValue(20)
  fireEvent.change(screen.getByLabelText('Monto pedido por el cliente'), {
    target: { value: '30' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Guardar 158 g · $30.00' }),
  )
  expect(confirm).toHaveBeenCalledWith(0.158, 30)
  confirm.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(close).toHaveBeenCalledWith(false)
  expect(confirm).not.toHaveBeenCalled()
})
it('impide fracciones de gramo', () => {
  render(
    <GranelDialog
      product={product}
      onConfirm={vi.fn()}
      onOpenChange={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('Peso de la báscula (g)'), {
    target: { value: '0.5' },
  })
  expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled()
})
