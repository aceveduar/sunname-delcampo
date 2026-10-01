import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CartLine } from './CartContext'

/** Desplaza únicamente la lista: mantiene el foco y la posición de la página. */
export function useCartHighlight(
  cart: CartLine[],
  listRef: RefObject<HTMLDivElement | null>,
) {
  const previous = useRef(cart)
  const [highlighted, setHighlighted] = useState<CartLine | null>(null)
  useEffect(() => {
    const before = previous.current
    previous.current = cart
    const index = cart.findLastIndex((line) => {
      if (before.includes(line)) return false
      if (line.product.sold_by_weight) return cart.length > before.length
      const old = before.find((item) => item.product.id === line.product.id)
      return !old || line.quantity > old.quantity
    })
    if (index < 0) return
    setHighlighted(cart[index])
    const list = listRef.current
    const row = list?.children[index] as HTMLElement | undefined
    if (list && row) {
      const bounds = list.getBoundingClientRect()
      const item = row.getBoundingClientRect()
      if (item.bottom > bounds.bottom)
        list.scrollTop += item.bottom - bounds.bottom
      else if (item.top < bounds.top) list.scrollTop += item.top - bounds.top
    }
  }, [cart, listRef])
  useEffect(() => {
    if (!highlighted) return
    const timer = window.setTimeout(() => setHighlighted(null), 2000)
    return () => window.clearTimeout(timer)
  }, [highlighted])
  return highlighted
}
