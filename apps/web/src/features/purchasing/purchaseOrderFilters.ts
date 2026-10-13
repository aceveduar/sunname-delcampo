import { normalizeSearch } from '@/lib/text'
import { orderStatus } from './orderPresentation'
import type { PurchaseOrder } from './usePurchaseOrders'

export const PURCHASE_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'pending', label: 'Por recibir' },
  { key: 'partial', label: 'Parciales' },
  { key: 'received', label: 'Recibidas' },
  { key: 'ordered', label: 'Sin entregas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'cancelled', label: 'Canceladas' },
] as const
export type PurchaseFilter = (typeof PURCHASE_FILTERS)[number]['key']

export function matchesPurchaseStatus(
  order: PurchaseOrder,
  filter: PurchaseFilter,
) {
  return (
    filter === 'all' ||
    (filter === 'pending'
      ? order.status === 'ordered'
      : orderStatus(order) === filter)
  )
}
export function purchaseFilter(value: string | null): PurchaseFilter {
  return PURCHASE_FILTERS.find((item) => item.key === value)?.key ?? 'all'
}
export function filterPurchaseOrders(
  orders: PurchaseOrder[],
  filter: PurchaseFilter,
  query: string,
) {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean)
  return orders.filter(
    (order) =>
      matchesPurchaseStatus(order, filter) &&
      tokens.every((token) =>
        normalizeSearch((order.supplier?.name ?? '') + ' ' + order.id).includes(
          token,
        ),
      ),
  )
}
export function purchaseStatusCounts(orders: PurchaseOrder[]) {
  return Object.fromEntries(
    PURCHASE_FILTERS.map((item) => [
      item.key,
      orders.filter((order) => matchesPurchaseStatus(order, item.key)).length,
    ]),
  ) as Record<PurchaseFilter, number>
}
