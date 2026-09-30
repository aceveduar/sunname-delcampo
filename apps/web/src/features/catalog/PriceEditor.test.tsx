import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PriceEditor } from './PriceEditor'
import type { Product } from './useProducts'
vi.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }))
afterEach(cleanup)
const products = [
  {
    id: 'a',
    name: 'Arroz',
    price: 20,
    unit_id: 'u',
    sold_by_weight: false,
    active: true,
    sku: null,
  },
  {
    id: 'b',
    name: 'Bolsa',
    price: 5,
    unit_id: 'u',
    sold_by_weight: false,
    active: true,
    sku: null,
  },
] as Product[]

it('revisa cambios fuera de la búsqueda y no envía antes de confirmar', async () => {
  const save = vi.fn().mockResolvedValue(true)
  const close = vi.fn()
  render(
    <PriceEditor
      products={products}
      onSave={save}
      onClose={close}
      unitCode={() => 'PZA'}
    />,
  )
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '25' },
  })
  fireEvent.change(screen.getByPlaceholderText('Buscar nombre o código…'), {
    target: { value: 'Bolsa' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar 1 cambio' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Arroz')
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar precios' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(save).toHaveBeenCalledWith([
    { id: 'a', price: 25, price_per_100g: null },
  ])
})
it('bloquea todos los cambios si otro producto tiene un importe inválido', () => {
  const save = vi.fn()
  render(
    <PriceEditor
      products={products}
      onSave={save}
      onClose={vi.fn()}
      unitCode={() => 'PZA'}
    />,
  )
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '' },
  })
  fireEvent.change(screen.getAllByRole('spinbutton')[1], {
    target: { value: '8' },
  })
  expect(
    screen.getByRole('button', { name: 'Revisar 1 cambio' }),
  ).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Arroz')
  expect(save).not.toHaveBeenCalled()
})
