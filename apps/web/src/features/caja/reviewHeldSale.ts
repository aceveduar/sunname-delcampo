import type { Product } from '@/features/catalog/useProducts'
import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/readAllPages'
import { formatCurrency } from '@/lib/currency'
import { restoreDraft } from './cartDraft'
import { NO_CUSTOMER } from './CartContext'
import { saleTotal, type HeldSale } from './heldSales'

export function prepareHeldSale(
  sale: HeldSale,
  products: Product[],
  stock: { product_id: string | null; quantity_on_hand: number | null }[],
  customer: { id: string; name: string; active: boolean } | null,
) {
  const warnings: string[] = []
  const compatible = products.filter((product) => {
    const saved = sale.products.find((item) => item.id === product.id)
    return saved?.unitId === product.unit_id
  })
  for (const line of sale.draft.lines) {
    const product = compatible.find((item) => item.id === line.productId)
    const name =
      sale.products.find((item) => item.id === line.productId)?.name ??
      'Producto'
    const restored = restoreDraft({ ...sale.draft, lines: [line] }, compatible)
    if (restored.omitted)
      warnings.push(
        name +
          ': no se cargará porque ya no está disponible o cambió su unidad de venta.',
      )
    else if (restored.repriced)
      warnings.push(
        name +
          ': se aplicará el precio vigente (' +
          formatCurrency(product!.price) +
          (product!.sold_by_weight
            ? '/kg y ' +
              formatCurrency(product!.price_per_100g ?? 0) +
              '/100 g).'
            : ').'),
      )
  }
  const { cart } = restoreDraft(sale.draft, compatible)
  const quantities = new Map<string, number>()
  for (const line of cart)
    quantities.set(
      line.product.id,
      (quantities.get(line.product.id) ?? 0) + Math.round(line.quantity * 1000),
    )
  for (const [id, quantity] of quantities) {
    const product = cart.find((line) => line.product.id === id)!.product
    if (!product.track_inventory) continue
    const balance = stock.find((item) => item.product_id === id)
    if (balance && balance.quantity_on_hand === null)
      throw new Error('No se pudieron comprobar las existencias.')
    const available = balance?.quantity_on_hand ?? 0
    if (quantity > Math.round(available * 1000))
      warnings.push(
        product.name +
          ': existencia insuficiente (' +
          available.toLocaleString('es-MX', { maximumFractionDigits: 3 }) +
          (product.sold_by_weight ? ' kg' : ' unidades') +
          '). Ajusta la cantidad antes de cobrar.',
      )
  }
  const requestedCustomer =
    sale.draft.customerId && sale.draft.customerId !== NO_CUSTOMER
  if (requestedCustomer && !customer?.active)
    warnings.push(
      'El cliente ya no está disponible. La venta se retomará sin cliente.',
    )
  return {
    cart,
    customerId: customer?.active ? customer.id : NO_CUSTOMER,
    customerName: customer?.active ? customer.name : null,
    total: saleTotal(cart),
    warnings,
  }
}
export type HeldSaleReview = ReturnType<typeof prepareHeldSale>

export async function reviewHeldSale(
  sale: HeldSale,
  sessionId: string,
): Promise<HeldSaleReview> {
  const ids = [...new Set(sale.draft.lines.map((line) => line.productId))]
  const products: Product[] = []
  const stock: {
    product_id: string | null
    quantity_on_hand: number | null
  }[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100)
    const [catalog, balances] = await Promise.all([
      readAllPages((from, to) =>
        supabase
          .from('product_catalog')
          .select('*', { count: 'exact' })
          .in('id', batch)
          .order('id')
          .range(from, to),
      ),
      readAllPages((from, to) =>
        supabase
          .from('inventory_stock')
          .select('product_id, quantity_on_hand', { count: 'exact' })
          .in('product_id', batch)
          .order('product_id')
          .range(from, to),
      ),
    ])
    products.push(...(catalog as Product[]))
    stock.push(...balances)
  }
  const [session, customer] = await Promise.all([
    supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single(),
    sale.draft.customerId && sale.draft.customerId !== NO_CUSTOMER
      ? supabase
          .from('customers')
          .select('id, name, active')
          .eq('id', sale.draft.customerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (session.error) throw session.error
  if (session.data?.status !== 'open')
    throw new Error('La caja ya está cerrada. Actualiza la pantalla.')
  if (customer.error) throw customer.error
  return prepareHeldSale(sale, products, stock, customer.data)
}
