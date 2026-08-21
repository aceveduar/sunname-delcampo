import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { reportError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useProducts, type Product } from '@/features/catalog/useProducts'
import { useCustomers } from '@/features/crm/useCustomers'
import { usePaymentMethods } from './usePaymentMethods'
import { GranelDialog } from './GranelDialog'
import { granelTotalFromWeightKg } from '@/lib/granel'
import { ReceiptDialog, type ReceiptData } from './ReceiptDialog'

type CartLine = { product: Product; quantity: number }

const NO_CUSTOMER = 'none'

export function SaleScreen({ cashSessionId }: { cashSessionId: string }) {
  const { products } = useProducts()
  const paymentMethods = usePaymentMethods()
  const { customers } = useCustomers()

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const [submitting, setSubmitting] = useState(false)
  const [granelProduct, setGranelProduct] = useState<Product | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Un cajero escaneando seguido no debe tener que volver a hacer clic en
  // el buscador después de cada producto -- el foco regresa solo.
  const refocusSearch = () => {
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const activeCustomers = customers.filter((c) => c.active)

  const results = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return products
      .filter(
        (p) =>
          p.active &&
          (p.name.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query)),
      )
      .slice(0, 20)
  }, [products, search])

  const lineTotal = (line: CartLine) =>
    line.product.sold_by_weight
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

  const addToCart = (product: Product, weightKg?: number) => {
    if (product.sold_by_weight) {
      // El peso siempre se captura exacto (báscula o monto pedido) --
      // no tiene sentido "sumar 1" a un producto que se pesa.
      setCart((prev) => [...prev, { product, quantity: weightKg ?? 0 }])
      return
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id)
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const handleProductClick = (product: Product) => {
    if (product.sold_by_weight) {
      setGranelProduct(product)
      return
    }
    addToCart(product)
    refocusSearch()
  }

  const setQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.product.id !== productId)
        : prev.map((line) =>
            line.product.id === productId ? { ...line, quantity } : line,
          ),
    )
  }

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((line) => line.product.id !== productId))
  }

  // Un lector de código de barras "escribe" el código y manda Enter — si
  // lo que se acaba de teclear coincide exacto con un SKU, se agrega
  // directo al carrito sin que el cajero tenga que buscar ni hacer clic.
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    const query = search.trim().toLowerCase()
    if (!query) return

    const scanned = products.find(
      (p) => p.active && p.sku?.toLowerCase() === query,
    )
    if (!scanned) return

    event.preventDefault()
    if (scanned.sold_by_weight) {
      setGranelProduct(scanned)
      setSearch('')
      return
    }
    addToCart(scanned)
    toast.success(`Agregado: ${scanned.name}`)
    setSearch('')
  }

  const resetSale = () => {
    setCart([])
    setCashReceived('')
    setPaymentMethodId('')
    setCustomerId(NO_CUSTOMER)
  }

  const handleCheckout = async () => {
    if (cart.length === 0 || !paymentMethodId) return
    setSubmitting(true)

    const { data: saleId, error } = await supabase.rpc('create_sale', {
      p_client_uuid: crypto.randomUUID(),
      p_cash_session_id: cashSessionId,
      p_items: cart.map((line) => ({
        product_id: line.product.id,
        quantity: line.quantity,
      })),
      p_payments: [{ payment_method_id: paymentMethodId, amount: total }],
      p_customer_id: customerId === NO_CUSTOMER ? undefined : customerId,
    })

    setSubmitting(false)

    if (error) {
      reportError('No se pudo registrar la venta', error)
      return
    }

    toast.success('Venta registrada')
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
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar producto, o escanear su código de barras…"
            className="pl-8"
            autoFocus
          />
        </div>

        {search.trim() === '' ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Escribe para buscar un producto y agregarlo a la venta.
          </p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No se encontraron productos para "{search}".
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="hover:bg-muted border-border bg-card flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors"
              >
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt=""
                    className="border-border size-10 shrink-0 rounded-md border object-cover"
                  />
                )}
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {product.sold_by_weight
                      ? `${formatCurrency(product.price)}/kg · ${formatCurrency(product.price_per_100g ?? 0)}/100g`
                      : formatCurrency(product.price)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Venta actual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no hay productos en la venta.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {cart.map((line, index) => (
                <div
                  key={`${line.product.id}-${index}`}
                  className="flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {line.product.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {line.product.sold_by_weight
                        ? `${Math.round(line.quantity * 1000)} g`
                        : `${formatCurrency(line.product.price)} c/u`}
                    </p>
                  </div>
                  {!line.product.sold_by_weight && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() =>
                          setQuantity(line.product.id, line.quantity - 1)
                        }
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center text-sm">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() =>
                          setQuantity(line.product.id, line.quantity + 1)
                        }
                      >
                        <Plus />
                      </Button>
                    </div>
                  )}
                  <span className="w-16 text-right text-sm font-medium">
                    {formatCurrency(lineTotal(line))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      line.product.sold_by_weight
                        ? setCart((prev) => prev.filter((_, i) => i !== index))
                        : removeLine(line.product.id)
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-border flex items-center justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="text-brand-gold">{formatCurrency(total)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Select
              items={[
                { value: NO_CUSTOMER, label: 'Sin cliente' },
                ...activeCustomers.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={customerId}
              onValueChange={(value) => setCustomerId(value ?? NO_CUSTOMER)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>Sin cliente</SelectItem>
                {activeCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Select
              items={paymentMethods.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              value={paymentMethodId}
              onValueChange={(value) => setPaymentMethodId(value ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMethod?.code === 'cash' && (
            <div className="flex flex-col gap-1.5">
              <Input
                type="number"
                step="0.01"
                min="0"
                autoComplete="off"
                placeholder="Efectivo recibido"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
              />
              {change !== null && cashReceived !== '' && (
                <p
                  className={
                    change < 0
                      ? 'text-destructive text-sm'
                      : 'text-success text-sm'
                  }
                >
                  {change < 0
                    ? `Falta ${formatCurrency(Math.abs(change))}`
                    : `Cambio: ${formatCurrency(change)}`}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={
              cart.length === 0 ||
              !paymentMethodId ||
              submitting ||
              (selectedMethod?.code === 'cash' && received < total)
            }
          >
            {submitting ? 'Cobrando…' : `Cobrar ${formatCurrency(total)}`}
          </Button>
        </CardContent>
      </Card>

      <GranelDialog
        product={granelProduct}
        onOpenChange={(open) => {
          if (!open) setGranelProduct(null)
        }}
        onConfirm={(weightKg) => {
          if (granelProduct) {
            addToCart(granelProduct, weightKg)
            toast.success(`Agregado: ${granelProduct.name}`)
          }
          setGranelProduct(null)
          refocusSearch()
        }}
      />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}
