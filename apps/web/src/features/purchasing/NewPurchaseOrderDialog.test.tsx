import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { NewPurchaseOrderDialog } from './NewPurchaseOrderDialog'
import type { Supplier } from './useSuppliers'
import type { Product } from '@/features/catalog/useProducts'
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
afterEach(cleanup)
const products = [
  { id: 'p1', name: 'Café de olla', sku: 'CAF-01', active: true },
  { id: 'p2', name: 'Mole rojo', sku: 'MOL-02', active: true },
] as Product[]
const suppliers = [
  { id: 's1', name: 'Distribuidora', active: true },
] as Supplier[]
it('busca sin acentos y por código, agrega varios sin duplicar y protege el descarte', async () => {
  const user = userEvent.setup()
  render(
    <NewPurchaseOrderDialog
      products={products}
      suppliers={suppliers}
      onCreate={vi.fn()}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Nueva orden' }))
  const search = screen.getByRole('textbox', {
    name: 'Buscar productos para la orden',
  })
  await user.type(search, 'cafe')
  await user.click(screen.getByRole('button', { name: 'Agregar Café de olla' }))
  expect(
    screen.getByRole('button', { name: 'En la orden: Café de olla' }),
  ).toBeDisabled()
  await user.clear(search)
  await user.type(search, 'MOL-02')
  await user.click(screen.getByRole('button', { name: 'Agregar Mole rojo' }))
  expect(screen.getByLabelText('Cantidad de Mole rojo')).toHaveValue(1)
  fireEvent.change(screen.getByLabelText('Costo de Mole rojo'), {
    target: { value: '40' },
  })
  await user.click(screen.getAllByRole('button', { name: 'Cerrar' })[0])
  const confirmation = await screen.findByRole('dialog', {
    name: '¿Descartar esta orden?',
  })
  await user.click(
    within(confirmation).getByRole('button', { name: 'Cancelar' }),
  )
  expect(screen.getByLabelText('Costo de Mole rojo')).toHaveValue(40)
  await user.click(screen.getAllByRole('button', { name: 'Cerrar' })[0])
  await user.click(screen.getByRole('button', { name: 'Descartar orden' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await user.click(screen.getByRole('button', { name: 'Nueva orden' }))
  expect(
    screen.queryByLabelText('Cantidad de Mole rojo'),
  ).not.toBeInTheDocument()
})
it('conserva la captura al cerrar una solicitud sin confirmar y reintenta los mismos datos', async () => {
  const user = userEvent.setup()
  const create = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
  render(
    <NewPurchaseOrderDialog
      products={products}
      suppliers={suppliers}
      onCreate={create}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Nueva orden' }))
  await user.click(screen.getByRole('combobox', { name: 'Proveedor' }))
  await user.click(await screen.findByRole('option', { name: 'Distribuidora' }))
  await user.click(screen.getByRole('button', { name: 'Agregar Mole rojo' }))
  fireEvent.change(screen.getByLabelText('Costo de Mole rojo'), {
    target: { value: '40' },
  })
  await user.click(screen.getByRole('button', { name: 'Crear orden' }))
  await screen.findByText(/Tu captura se conserva/)
  await user.click(screen.getAllByRole('button', { name: 'Cerrar' })[0])
  await user.click(screen.getByRole('button', { name: 'Nueva orden' }))
  expect(screen.getByLabelText('Costo de Mole rojo')).toHaveValue(40)
  await user.click(screen.getByRole('button', { name: 'Crear orden' }))
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
  expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0])
})
