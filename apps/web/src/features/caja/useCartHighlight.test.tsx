import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CartLine } from './CartContext'
import { useCartHighlight } from './useCartHighlight'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('resalta la última pesada, una unidad adicional y limpia el resaltado', () => {
  vi.useFakeTimers()
  const listRef = { current: null }
  const piece = {
    product: { id: 'piece', sold_by_weight: false },
    quantity: 1,
  } as CartLine
  const weighed = {
    product: { id: 'weight', sold_by_weight: true },
    quantity: 0.1,
  } as CartLine
  const { result, rerender } = renderHook(
    ({ cart }) => useCartHighlight(cart, listRef),
    {
      initialProps: { cart: [piece, weighed] },
    },
  )
  expect(result.current).toBeNull()
  const secondWeight = { ...weighed, quantity: 0.2 }
  rerender({ cart: [piece, weighed, secondWeight] })
  expect(result.current).toBe(secondWeight)
  const addedPiece = { ...piece, quantity: 2 }
  rerender({ cart: [addedPiece, weighed, secondWeight] })
  expect(result.current).toBe(addedPiece)
  act(() => {
    vi.advanceTimersByTime(2000)
  })
  expect(result.current).toBeNull()
  rerender({ cart: [weighed, secondWeight] })
  expect(result.current).toBeNull()
})
