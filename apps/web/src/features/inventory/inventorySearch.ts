import { normalizeSearch } from '@/lib/text'
import type { StockRow } from './useInventoryStock'

/** Exact codes lead; remaining words can match the name and code in any order. */
export function searchStockRows(rows: StockRow[], search: string) {
  const query = normalizeSearch(search)
  if (!query) return rows
  const words = query.split(/\s+/)
  return rows
    .filter(({ product }) => {
      const text = normalizeSearch(product.name + ' ' + (product.sku ?? ''))
      return words.every((word) => text.includes(word))
    })
    .sort(
      (a, b) =>
        Number(normalizeSearch(b.product.sku ?? '') === query) -
        Number(normalizeSearch(a.product.sku ?? '') === query),
    )
}
