// Comparación reproducible del algoritmo anterior y el índice; sin red ni datos reales.
import { bench, describe } from 'vitest'
import type { Product } from '@/features/catalog/useProducts'
import { normalizeSearch } from '@/lib/text'
import { createProductSearch } from './productSearch'

function previousSearch(products: Product[], search: string, category: string) {
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

for (const size of [500, 5000]) {
  const products = Array.from(
    { length: size },
    (_, i) =>
      ({
        id: String(i),
        name: 'Café molido presentación ' + i,
        sku: 'SKU-' + i,
        active: i % 10 !== 0,
        category_id: 'c' + (i % 4),
      }) as Product,
  )
  const indexed = createProductSearch(products)
  const queries = [
    'c',
    'ca',
    'caf',
    'cafe',
    'cafe molido',
    'sku-25',
    'inexistente',
  ]
  describe(size + ' productos / siete búsquedas', () => {
    bench('anterior', () => {
      for (const query of queries) previousSearch(products, query, 'all')
    })
    bench('índice reutilizado', () => {
      for (const query of queries) indexed(query, 'all')
    })
    bench('construcción y siete búsquedas', () => {
      const search = createProductSearch(products)
      for (const query of queries) search(query, 'all')
    })
  })
}
