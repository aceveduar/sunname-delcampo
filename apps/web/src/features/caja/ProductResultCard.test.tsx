import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ProductResultCard } from './ProductResultCard'
import type { Product } from '@/features/catalog/useProducts'
afterEach(cleanup)
it('fija favoritos sin agregar productos a la venta', () => {
  const add = vi.fn(),
    toggle = vi.fn()
  render(
    <ProductResultCard
      product={
        { id: 'a', name: 'Chile', price: 20, sold_by_weight: false } as Product
      }
      onClick={add}
      onToggleFavorite={toggle}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Fijar favorito: Chile' }))
  expect(toggle).toHaveBeenCalledOnce()
  expect(add).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Chile.*20/ }))
  expect(add).toHaveBeenCalledOnce()
})
