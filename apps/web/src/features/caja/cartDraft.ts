import type { Product } from '@/features/catalog/useProducts'
import type { CartLine } from './CartContext'
import { granelWeightKgFromAmount } from '@/lib/granel'

type DraftLine = {
  productId: string
  quantity: number
  amountMxn?: number
  price: number
  pricePer100g: number | null
  soldByWeight: boolean
}
export type CartDraft = {
  version: 1
  sessionId: string
  checkoutId: string | null
  lines: DraftLine[]
}

export function draftKey(userId: string) {
  return `sunname:cart:v1:${import.meta.env.VITE_SUPABASE_URL ?? 'local'}:${userId}`
}

export function parseDraft(value: string | null): CartDraft | null {
  try {
    const draft = JSON.parse(value ?? 'null') as CartDraft | null
    if (
      !draft ||
      draft.version !== 1 ||
      typeof draft.sessionId !== 'string' ||
      !(draft.checkoutId === null || typeof draft.checkoutId === 'string') ||
      !Array.isArray(draft.lines) ||
      !draft.lines.length
    )
      return null
    if (
      !draft.lines.every(
        (line) =>
          line &&
          typeof line.productId === 'string' &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0 &&
          Number.isFinite(line.price) &&
          line.price >= 0 &&
          typeof line.soldByWeight === 'boolean' &&
          (line.soldByWeight || Number.isInteger(line.quantity)) &&
          (line.pricePer100g === null ||
            (Number.isFinite(line.pricePer100g) && line.pricePer100g >= 0)) &&
          (line.amountMxn === undefined ||
            (line.soldByWeight &&
              Number.isFinite(line.amountMxn) &&
              line.amountMxn > 0)),
      )
    )
      return null
    return draft
  } catch {
    return null
  }
}

export function createDraft(
  cart: CartLine[],
  sessionId: string,
  checkoutId: string | null,
): CartDraft {
  return {
    version: 1,
    sessionId,
    checkoutId,
    lines: cart.map(({ product, quantity, amountMxn }) => ({
      productId: product.id,
      quantity,
      amountMxn,
      price: product.price,
      pricePer100g: product.price_per_100g,
      soldByWeight: product.sold_by_weight,
    })),
  }
}

/** Se reconstruye con el catálogo actual, nunca con precios guardados en el navegador. */
export function restoreDraft(draft: CartDraft, products: Product[]) {
  const cart: CartLine[] = []
  let omitted = 0
  let repriced = 0
  for (const line of draft.lines) {
    const product = products.find((product) => product.id === line.productId)
    if (
      !product?.active ||
      product.price <= 0 ||
      product.sold_by_weight !== line.soldByWeight
    ) {
      omitted++
      continue
    }
    const quantity =
      line.amountMxn === undefined
        ? line.quantity
        : granelWeightKgFromAmount(
            line.amountMxn,
            product.price,
            product.price_per_100g ?? 0,
          )
    if (!Number.isFinite(quantity) || quantity <= 0) {
      omitted++
      continue
    }
    if (
      product.price !== line.price ||
      product.price_per_100g !== line.pricePer100g
    )
      repriced++
    const existing =
      !product.sold_by_weight &&
      cart.find((item) => item.product.id === product.id)
    if (existing) existing.quantity += quantity
    else
      cart.push({
        product,
        quantity,
        ...(line.amountMxn === undefined ? {} : { amountMxn: line.amountMxn }),
      })
  }
  return { cart, omitted, repriced }
}
