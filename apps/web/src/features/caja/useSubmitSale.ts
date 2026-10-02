import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useRef, useState } from 'react'
import { formatCurrency } from '@/lib/currency'
import { reportError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { granelTotalFromWeightKg } from '@/lib/granel'
import type { Customer } from '@/features/crm/useCustomers'
import type { PaymentMethod } from './usePaymentMethods'
import { useCart, NO_CUSTOMER, type CartLine } from './CartContext'
import type { ReceiptData } from './ReceiptDialog'

/** Cobro de la venta en curso: registra create_sale y arma el ticket.
 * El resto de Caja (buscar/agregar productos, granel, voz) vive en
 * SaleScreen -- esto es solo el tramo de "ya está el carrito, cóbralo". */
export function useSubmitSale({
  cashSessionId,
  paymentMethods,
  customers,
  catalogReady,
  onSaleRecorded,
}: {
  cashSessionId: string
  paymentMethods: PaymentMethod[]
  customers: Customer[]
  catalogReady: boolean
  onSaleRecorded?: () => void
}) {
  const {
    cart,
    pendingDraft,
    beginCheckout,
    holdForVerification,
    resetSale,
    paymentMethodId,
    cashReceived,
    customerId,
  } = useCart()
  const online = useOnlineStatus()
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  const lineTotal = (line: CartLine) =>
    line.amountMxn !== undefined
      ? line.amountMxn
      : line.product.sold_by_weight
        ? granelTotalFromWeightKg(
            line.quantity,
            line.product.price,
            line.product.price_per_100g ?? 0,
          )
        : line.product.price * line.quantity

  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0)

  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId)
  const received = Number(cashReceived || 0)
  const change = selectedMethod?.code === 'cash' ? received - total : null
  const checkoutDisabled =
    !online ||
    cart.length === 0 ||
    !selectedMethod ||
    !catalogReady ||
    !!pendingDraft ||
    !Number.isFinite(received) ||
    submitting ||
    (selectedMethod?.code === 'cash' && received < total)

  const handleCheckout = async () => {
    if (checkoutDisabled || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    try {
      const { data: saleId, error } = await supabase.rpc('create_sale', {
        p_client_uuid: beginCheckout(),
        p_cash_session_id: cashSessionId,
        p_items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          // Si la línea se pidió por monto, manda el monto: create_sale
          // deriva el peso y cobra ese monto exacto.
          ...(line.amountMxn !== undefined ? { amount: line.amountMxn } : {}),
        })),
        p_payments: [{ payment_method_id: paymentMethodId, amount: total }],
        p_customer_id: customerId === NO_CUSTOMER ? undefined : customerId,
      })

      if (error) throw error
      if (!saleId) throw new Error('La venta no devolvió una confirmación')

      setReceipt({
        saleId: saleId as string,
        createdAt: new Date().toISOString(),
        lines: cart.map((line) => ({
          name: line.product.name,
          detail: line.product.sold_by_weight
            ? `${Math.round(line.quantity * 1000)} g`
            : `${line.quantity} x ${formatCurrency(line.product.price)}`,
          total: lineTotal(line),
        })),
        total,
        paymentMethodName: selectedMethod?.name ?? '—',
        cashReceived: selectedMethod?.code === 'cash' ? received : null,
        change: selectedMethod?.code === 'cash' ? change : null,
        customerName:
          customerId === NO_CUSTOMER
            ? null
            : (customers.find((c) => c.id === customerId)?.name ?? null),
      })
      resetSale()
      onSaleRecorded?.()
    } catch (error) {
      holdForVerification()
      reportError(
        'No se pudo confirmar la venta. Verifica el cobro antes de continuar.',
        error,
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return {
    total,
    selectedMethod,
    received,
    change,
    checkoutDisabled,
    submitting,
    receipt,
    setReceipt,
    handleCheckout,
    lineTotal,
  }
}
