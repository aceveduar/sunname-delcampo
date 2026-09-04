import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, ScanBarcode, Search, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
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
import { useCategories } from '@/features/catalog/useCategories'
import { useProducts, type Product } from '@/features/catalog/useProducts'
import { useCustomers } from '@/features/crm/useCustomers'
import { normalizeSearch } from '@/lib/text'
import { usePaymentMethods } from './usePaymentMethods'
import { GranelDialog } from './GranelDialog'
import { granelTotalFromWeightKg, granelWeightKgFromAmount } from '@/lib/granel'
import { ReceiptDialog, type ReceiptData } from './ReceiptDialog'
import { VoiceCommandButton } from './VoiceCommandButton'

// amountMxn solo existe en líneas pedidas "por monto" ("dame $50 de
// piquín"): ahí el total de la línea es ese monto exacto y quantity es
// el peso derivado. En las demás líneas el total sale de quantity ×
// tarifa, como siempre.
type CartLine = { product: Product; quantity: number; amountMxn?: number }

const NO_CUSTOMER = 'none'

export function SaleScreen({ cashSessionId }: { cashSessionId: string }) {
  const { products } = useProducts()
  const paymentMethods = usePaymentMethods()
  const { customers } = useCustomers()
  const { categories } = useCategories()

  const [search, setSearch] = useState('')
  // Filtro secundario, opcional -- para cuando el cliente pide "algo de
  // especias" sin saber el nombre exacto. No cambia en nada la búsqueda
  // por texto de siempre: en 'all' (su default) el comportamiento es
  // idéntico al de antes de que existiera este filtro.
  const [filterCategory, setFilterCategory] = useState('all')
  const [cart, setCart] = useState<CartLine[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const [submitting, setSubmitting] = useState(false)
  const [granelProduct, setGranelProduct] = useState<Product | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cada negocio marca cuál es su método de pago más usado (es_default en
  // payment_methods, configurable por tenant) -- no se asume "efectivo"
  // en el código, se lee de los datos de cada negocio.
  const defaultMethodId =
    paymentMethods.find((m) => m.is_default)?.id ?? paymentMethods[0]?.id ?? ''

  useEffect(() => {
    if (!paymentMethodId && defaultMethodId) setPaymentMethodId(defaultMethodId)
  }, [defaultMethodId, paymentMethodId])

  // Una búsqueda = un producto agregado = listo para la siguiente -- igual
  // sea por clic o por escaneo, el buscador se limpia y recupera el foco
  // solo, sin que el cajero tenga que volver a tocarlo entre productos.
  const afterAdd = () => {
    setSearch('')
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const activeCustomers = customers.filter((c) => c.active)
  const activeCategories = categories.filter((c) => c.active)

  const results = useMemo(() => {
    const query = normalizeSearch(search)
    if (!query && filterCategory === 'all') return []
    return products
      .filter(
        (p) =>
          p.active &&
          (filterCategory === 'all' || p.category_id === filterCategory) &&
          (!query ||
            normalizeSearch(p.name).includes(query) ||
            (p.sku && normalizeSearch(p.sku).includes(query))),
      )
      .slice(0, 20)
  }, [products, search, filterCategory])

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
    cart.length === 0 ||
    !paymentMethodId ||
    submitting ||
    (selectedMethod?.code === 'cash' && received < total)

  const addToCart = (
    product: Product,
    weightKg?: number,
    amountMxn?: number,
    pieceQuantity = 1,
  ) => {
    if (product.sold_by_weight) {
      // El peso siempre se captura exacto (báscula o monto pedido) --
      // no tiene sentido "sumar 1" a un producto que se pesa.
      setCart((prev) => [...prev, { product, quantity: weightKg ?? 0, amountMxn }])
      return
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id)
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + pieceQuantity }
            : line,
        )
      }
      return [...prev, { product, quantity: pieceQuantity }]
    })
  }

  // Voz solo llena este mismo carrito -- nunca cobra directo. El monto
  // manda a la misma cuenta de create_sale del lado del servidor
  // (VoiceCommandButton ya exigió confirmación antes de llegar aquí).
  const handleVoiceAmount = (product: Product, amountMxn: number) => {
    const weightKg = granelWeightKgFromAmount(
      amountMxn,
      product.price,
      product.price_per_100g ?? 0,
    )
    if (weightKg <= 0) {
      toast.error('Este producto todavía no tiene precio -- agrégalo en Catálogo.')
      return
    }
    addToCart(product, weightKg, amountMxn)
    toast.success(`Agregado: ${product.name}`)
    afterAdd()
  }

  const handleVoiceQuantity = (product: Product, quantity: number) => {
    addToCart(product, undefined, undefined, quantity)
    toast.success(`Agregado: ${product.name}`)
    afterAdd()
  }

  const handleProductClick = (product: Product) => {
    if (product.sold_by_weight) {
      setGranelProduct(product)
      return
    }
    addToCart(product)
    afterAdd()
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

  const findExactSkuMatch = (code: string) => {
    const query = normalizeSearch(code)
    if (!query) return null
    return (
      products.find((p) => p.active && p.sku && normalizeSearch(p.sku) === query) ??
      null
    )
  }

  const addScannedProduct = (product: Product) => {
    if (product.sold_by_weight) {
      setGranelProduct(product)
      setSearch('')
      return
    }
    addToCart(product)
    toast.success(`Agregado: ${product.name}`)
    afterAdd()
  }

  // Un lector de código de barras "escribe" el código y manda Enter — si
  // lo que se acaba de teclear coincide exacto con un SKU, se agrega
  // directo al carrito sin que el cajero tenga que buscar ni hacer clic.
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    const scanned = findExactSkuMatch(search)
    if (!scanned) {
      // Si tampoco hay coincidencias parciales por nombre, lo más probable
      // es que se haya escaneado un código que no está dado de alta.
      if (results.length === 0) {
        toast.error('Código no reconocido: ningún producto lo tiene registrado.')
      }
      return
    }
    event.preventDefault()
    addScannedProduct(scanned)
  }

  // Respaldo para cuando no hay lector físico a la mano -- el camino
  // rápido normal sigue siendo el lector USB (sin cambiar de pantalla)
  // o la voz; la cámara aquí es solo un tercer camino, no el principal.
  const handleCameraScan = (code: string) => {
    const scanned = findExactSkuMatch(code)
    if (!scanned) {
      toast.error('Código no reconocido: ningún producto lo tiene registrado.')
      return
    }
    addScannedProduct(scanned)
  }

  const resetSale = () => {
    setCart([])
    setCashReceived('')
    setPaymentMethodId(defaultMethodId)
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
        // Si la línea se pidió por monto, manda el monto: create_sale
        // deriva el peso y cobra ese monto exacto.
        ...(line.amountMxn !== undefined ? { amount: line.amountMxn } : {}),
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

  // handleCheckout se vuelve a crear en cada render (no memoizado, cierra
  // sobre cart/total/etc.) -- una ref evita que el listener de abajo se
  // tenga que re-suscribir en cada tecla mientras deja que F9 siempre
  // llame a la versión más reciente.
  const handleCheckoutRef = useRef(handleCheckout)
  useEffect(() => {
    handleCheckoutRef.current = handleCheckout
  })

  // Atajos pensados para el cajero: F2 regresa el foco al buscador sin
  // soltar el mouse, F9 cobra sin llegar hasta el botón, Esc limpia el
  // buscador -- solo si el foco ya está ahí, para no interceptar el Esc
  // que cierra un diálogo abierto (GranelDialog/ReceiptDialog). Ambos
  // atajos de función se desactivan con un diálogo abierto, para no
  // disparar una acción de Caja detrás de él.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialogOpen = granelProduct !== null || receipt !== null
      if (event.key === 'F2' && !dialogOpen) {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (event.key === 'F9' && !dialogOpen) {
        event.preventDefault()
        if (!checkoutDisabled) handleCheckoutRef.current()
      } else if (
        event.key === 'Escape' &&
        document.activeElement === searchInputRef.current &&
        search
      ) {
        setSearch('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [granelProduct, receipt, checkoutDisabled, search])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <SearchInput
            ref={searchInputRef}
            value={search}
            onChange={setSearch}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar producto o código de barras…"
            containerClassName="min-w-[200px] flex-1"
            autoFocus
          />

          <VoiceCommandButton
            products={products}
            onAddByAmount={handleVoiceAmount}
            onAddByQuantity={handleVoiceQuantity}
            onOpenManualWeight={setGranelProduct}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Escanear código de barras con la cámara"
            onClick={() => setScannerOpen(true)}
          >
            <ScanBarcode />
          </Button>

          <Select
            items={[
              { value: 'all', label: 'Todas las categorías' },
              ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={filterCategory}
            onValueChange={(value) => setFilterCategory(value ?? 'all')}
          >
            <SelectTrigger className="w-full shrink-0 sm:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {activeCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {search.trim() === '' && filterCategory === 'all' ? (
          <EmptyState
            icon={Search}
            title="Busca un producto"
            description="Escribe un nombre o escanea el código de barras para agregarlo a la venta."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description={
              search.trim()
                ? `No se encontraron productos para "${search}".`
                : 'No hay productos activos en esta categoría.'
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                  {product.price === 0 ? (
                    <span className="text-destructive text-sm font-medium">
                      Sin precio
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {product.sold_by_weight
                        ? `${formatCurrency(product.price)}/kg · ${formatCurrency(product.price_per_100g ?? 0)}/100g`
                        : formatCurrency(product.price)}
                    </span>
                  )}
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
                  {/* Se probó mostrar aquí una sugerencia de cambio
                      redondeado y se quitó (2026-09-03): redondear al peso
                      más cercano cae hacia abajo cuando el cambio es menor
                      a $0.50, y terminaba sugiriendo "redondeado: $0.00"
                      sobre un cambio real de $0.40 -- o sea, quedarse con
                      el dinero del cliente. Qué monedas dar es criterio del
                      cajero, que sabe qué tiene en la caja; el sistema solo
                      dice el número exacto. */}
                  {change < 0
                    ? `Falta ${formatCurrency(Math.abs(change))}`
                    : `Cambio: ${formatCurrency(change)}`}
                </p>
              )}
            </div>
          )}

          {/* Cliente va al final a propósito: en un negocio de mostrador
              como Del Campo casi toda venta es anónima -- método de pago
              y efectivo recibido se tocan siempre, cliente solo a veces.
              El orden visual debe reflejar qué tan seguido se usa cada
              campo, no al revés (CLAUDE.md: velocidad del cajero primero). */}
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

          <Button onClick={handleCheckout} disabled={checkoutDisabled}>
            {submitting ? (
              'Cobrando…'
            ) : (
              <>
                {`Cobrar ${formatCurrency(total)}`}
                {/* El atajo es para quien tiene teclado (PC del negocio) --
                    en un celular/tablet por touch no aplica y solo le
                    resta espacio al botón en la pantalla más angosta. */}
                <kbd className="ml-1 hidden rounded border border-current/30 px-1 text-[10px] font-normal opacity-70 sm:inline">
                  F9
                </kbd>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <GranelDialog
        product={granelProduct}
        onOpenChange={(open) => {
          if (!open) setGranelProduct(null)
        }}
        onConfirm={(weightKg, amountMxn) => {
          if (granelProduct) {
            addToCart(granelProduct, weightKg, amountMxn)
            toast.success(`Agregado: ${granelProduct.name}`)
          }
          setGranelProduct(null)
          afterAdd()
        }}
      />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleCameraScan}
      />
    </div>
  )
}
