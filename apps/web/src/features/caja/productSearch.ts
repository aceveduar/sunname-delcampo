import type { Product } from '@/features/catalog/useProducts'
import { normalizeSearch } from '@/lib/text'

/** Índice local a una versión del catálogo: no conserva precios entre consultas. */
export function createProductSearch(products: Product[]) {
  const entries = products
    .filter((product) => product.active)
    .map((product) => ({
      product,
      name: normalizeSearch(product.name),
      sku: normalizeSearch(product.sku ?? ''),
    }))
  return (search: string, category: string) => {
    const query = normalizeSearch(search)
    if (!query && category === 'all') return []
    const exactSku: Product[] = []
    const exactName: Product[] = []
    const partial: Product[] = []
    for (const { product, name, sku } of entries) {
      if (category !== 'all' && product.category_id !== category) continue
      if (query && !name.includes(query) && !sku.includes(query)) continue
      if (query && sku === query) exactSku.push(product)
      else if (query && name === query) exactName.push(product)
      else partial.push(product)
    }
    return [...exactSku, ...exactName, ...partial]
  }
}

/** Búsqueda puntual. Para búsquedas sucesivas, reutilizar createProductSearch. */
export function searchProducts(
  products: Product[],
  search: string,
  category: string,
) {
  return createProductSearch(products)(search, category)
}
