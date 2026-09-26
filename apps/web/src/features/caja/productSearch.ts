import type { Product } from '@/features/catalog/useProducts'
import { normalizeSearch } from '@/lib/text'

export function searchProducts(
  products: Product[],
  search: string,
  category: string,
) {
  const query = normalizeSearch(search)
  if (!query && category === 'all') return []
  const rank = (product: Product) => {
    if (!query) return 2
    if (normalizeSearch(product.sku ?? '') === query) return 0
    if (normalizeSearch(product.name) === query) return 1
    return 2
  }
  return products
    .filter(
      (product) =>
        product.active &&
        (category === 'all' || product.category_id === category) &&
        (!query ||
          normalizeSearch(product.name).includes(query) ||
          normalizeSearch(product.sku ?? '').includes(query)),
    )
    .sort((a, b) => rank(a) - rank(b))
}
