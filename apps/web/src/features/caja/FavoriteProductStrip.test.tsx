import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FavoriteProductStrip } from './FavoriteProductStrip'
import type { Product } from '@/features/catalog/useProducts'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('mantiene los favoritos en su orden y permite quitar los inactivos sin venderlos', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const choose = vi.fn(),
    toggle = vi.fn()
  const products = [
    { id: 'a', name: 'Chipotles 105 G', price: 17.5, active: true },
    { id: 'b', name: 'Chipotles 220 G', price: 34, active: false },
    { id: 'c', name: 'Frijoles 580 G', price: 20, active: true },
  ] as Product[]
  render(
    <FavoriteProductStrip
      ids={['c', 'b', 'a']}
      products={products}
      onChoose={choose}
      onToggle={toggle}
    />,
  )
  const buy = screen.getAllByRole('button', { name: /\$/ })
  expect(buy.map((button) => button.textContent)).toEqual([
    'Frijoles 580 G$20.00',
    'Chipotles 105 G$17.50',
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Quitar favorito' }))
  expect(toggle).toHaveBeenCalledWith('b')
  expect(choose).not.toHaveBeenCalled()
  fireEvent.click(buy[0])
  expect(choose).toHaveBeenCalledWith(products[2])
})
