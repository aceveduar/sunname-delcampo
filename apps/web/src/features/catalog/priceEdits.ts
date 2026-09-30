import type { Product } from './useProducts'

export type PriceField = 'price' | 'price_per_100g'
export type PriceDrafts = Record<string, Partial<Record<PriceField, string>>>
export function priceError(value: string) {
  const number = Number(value)
  return value.trim() === '' ||
    !Number.isFinite(number) ||
    number < 0 ||
    number >= 1e10 ||
    Math.abs(number * 100 - Math.round(number * 100)) > 1e-6
    ? 'Ingresa un precio de 0 a 9,999,999,999.99 con hasta dos decimales.'
    : null
}

export function collectPriceEdits(products: Product[], drafts: PriceDrafts) {
  const changes: {
    id: string
    price: number
    price_per_100g: number | null
  }[] = []
  const errors: { id: string; name: string; message: string }[] = []
  for (const [id, draft] of Object.entries(drafts)) {
    const product = products.find((product) => product.id === id)
    if (!product) {
      errors.push({
        id,
        name: 'Producto no disponible',
        message: 'Vuelve al catálogo y actualiza la lista.',
      })
      continue
    }
    const price = draft.price ?? String(product.price)
    const smallPrice =
      draft.price_per_100g ?? String(product.price_per_100g ?? 0)
    const error =
      priceError(price) ??
      (product.sold_by_weight ? priceError(smallPrice) : null)
    if (error) {
      errors.push({ id, name: product.name, message: error })
      continue
    }
    const next = {
      id,
      price: Number(price),
      price_per_100g: product.sold_by_weight ? Number(smallPrice) : null,
    }
    if (
      next.price !== product.price ||
      (product.sold_by_weight &&
        next.price_per_100g !== (product.price_per_100g ?? 0))
    )
      changes.push(next)
  }
  return { changes, errors }
}
