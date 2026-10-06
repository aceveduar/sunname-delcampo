const formatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 })
export function formatStock(quantity: number) {
  return formatter.format(quantity)
}

/** Inventory captures a delta, in thousandths of the product's stock unit. */
export function parseMovementQuantity(value: string): number | null {
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(value.trim())) return null
  const quantity = Number(value)
  return Number.isFinite(quantity) && quantity > 0 && quantity < 1e9
    ? quantity
    : null
}
export function projectedStock(current: number, delta: number) {
  return (Math.round(current * 1000) + Math.round(delta * 1000)) / 1000
}
