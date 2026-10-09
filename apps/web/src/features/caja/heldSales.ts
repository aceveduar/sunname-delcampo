import { createDraft, parseDraft, type CartDraft } from './cartDraft'
import type { CartLine } from './CartContext'
import { granelTotalFromWeightKg } from '@/lib/granel'

export type HeldSale = {
  id: string
  label: string
  savedAt: string
  customerName: string | null
  total: number
  draft: CartDraft
  products: { id: string; name: string; unitId: string }[]
}
export type HeldSalesStore = {
  version: 1
  sales: HeldSale[]
  commits: string[]
}
export const HELD_SALES_LIMIT = 20

export function heldSalesKey(userId: string) {
  return `sunname:held-sales:v1:${import.meta.env.VITE_SUPABASE_URL ?? 'local'}:${userId}`
}
export function saleTotal(cart: CartLine[]) {
  return (
    cart.reduce(
      (sum, line) =>
        sum +
        Math.round(
          100 *
            (line.amountMxn ??
              (line.product.sold_by_weight
                ? granelTotalFromWeightKg(
                    line.quantity,
                    line.product.price,
                    line.product.price_per_100g ?? 0,
                  )
                : line.product.price * line.quantity)),
        ),
      0,
    ) / 100
  )
}
export function createHeldSale(
  cart: CartLine[],
  sessionId: string,
  customerId: string,
  customerName: string | null,
  label: string,
): HeldSale {
  return {
    id: crypto.randomUUID(),
    label: label.trim().slice(0, 80),
    savedAt: new Date().toISOString(),
    customerName,
    total: saleTotal(cart),
    draft: createDraft(cart, sessionId, null, customerId),
    products: cart.map(({ product }) => ({
      id: product.id,
      name: product.name,
      unitId: product.unit_id,
    })),
  }
}
export function parseHeldSales(raw: string | null): HeldSalesStore {
  if (raw === null) return { version: 1, sales: [], commits: [] }
  const value = JSON.parse(raw) as HeldSalesStore
  if (
    value?.version !== 1 ||
    !Array.isArray(value.sales) ||
    !Array.isArray(value.commits) ||
    !value.commits.every((id) => typeof id === 'string') ||
    !value.sales.every(
      (sale) =>
        sale &&
        typeof sale.id === 'string' &&
        sale.id &&
        typeof sale.label === 'string' &&
        typeof sale.savedAt === 'string' &&
        Number.isFinite(Date.parse(sale.savedAt)) &&
        (sale.customerName === null || typeof sale.customerName === 'string') &&
        Number.isFinite(sale.total) &&
        sale.total >= 0 &&
        parseDraft(JSON.stringify(sale.draft)) &&
        sale.draft.checkoutId === null &&
        Array.isArray(sale.products) &&
        sale.products.every(
          (product) =>
            product &&
            typeof product.id === 'string' &&
            typeof product.name === 'string' &&
            typeof product.unitId === 'string',
        ),
    ) ||
    new Set(value.sales.map((sale) => sale.id)).size !== value.sales.length
  ) {
    throw new Error(
      'No se pudieron leer las ventas en espera. Conserva los datos de este navegador.',
    )
  }
  return value
}
