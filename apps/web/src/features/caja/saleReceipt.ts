import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/currency'
import type { ReceiptData } from './ReceiptDialog'
export type StoredSale = {
  id: string
  created_at: string
  total: number
  status: 'completed' | 'voided'
  customer: { name: string } | null
  sale_items: {
    product_name: string | null
    sold_by_weight: boolean | null
    quantity: number
    unit_price: number
    subtotal: number
  }[]
  sale_payments: { amount: number; method: { name: string } | null }[]
}
export function storedSaleReceipt(sale: StoredSale): ReceiptData {
  return {
    saleId: sale.id,
    createdAt: sale.created_at,
    total: sale.total,
    status: sale.status,
    customerName: sale.customer?.name ?? null,
    cashReceived: null,
    change: null,
    paymentMethodName: sale.sale_payments
      .map(
        (payment) =>
          (payment.method?.name ?? 'Pago') +
          ' (' +
          formatCurrency(payment.amount) +
          ')',
      )
      .join(', '),
    lines: sale.sale_items.map((line) => ({
      name: line.product_name ?? 'Producto',
      detail: line.sold_by_weight
        ? Math.round(line.quantity * 1000) + ' g'
        : line.quantity + ' × ' + formatCurrency(line.unit_price),
      total: line.subtotal,
    })),
  }
}
export async function fetchSaleReceipt(saleId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, created_at, total, status, customer:customers(name), sale_items(product_name, sold_by_weight, quantity, unit_price, subtotal), sale_payments(amount, method:payment_methods(name))',
    )
    .eq('id', saleId)
    .single()
  return { data: data ? storedSaleReceipt(data as StoredSale) : null, error }
}
