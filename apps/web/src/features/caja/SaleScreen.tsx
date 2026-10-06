import { FavoriteProductStrip } from './FavoriteProductStrip'
import { CartScrollControls } from './CartScrollControls'
import { useFavoriteProducts } from './useFavoriteProducts'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCheckoutHeight } from './useCheckoutHeight'
import { LoadError } from '@/components/LoadError'
import { DraftRecovery } from './DraftRecovery'
import { searchProducts } from './productSearch'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import {
  Minus,
  Package,
  MoreHorizontal,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useSaleShortcuts } from '@/hooks/useSaleShortcuts'
import { MobileCartSummary } from './MobileCartSummary'
import { CashPaymentFields } from './CashPaymentFields'
import { useCartHighlight } from './useCartHighlight'
import { SearchInput } from '@/components/ui/search-input'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/currency'
import { useScrollShadows } from '@/hooks/useScrollShadows'
import type { Database } from '@/lib/database.types'
import { useCategories } from '@/features/catalog/useCategories'
import { useProducts, type Product } from '@/features/catalog/useProducts'
import { useCustomers } from '@/features/crm/useCustomers'
import { normalizeSearch } from '@/lib/text'
import { usePaymentMethods } from './usePaymentMethods'
import { GranelDialog } from './GranelDialog'
import { granelWeightKgFromAmount } from '@/lib/granel'
import { ReceiptDialog } from './ReceiptDialog'
import { VoiceCommandButton } from './VoiceCommandButton'
import { EditCartPriceDialog } from './EditCartPriceDialog'
import { useTopSellingProducts } from './useTopSellingProducts'
import { useCart, NO_CUSTOMER, type CartLine } from './CartContext'
import { useSubmitSale } from './useSubmitSale'
import { ProductResultCard } from './ProductResultCard'

type Role = Database['public']['Enums']['user_role']

// Compartida entre la rejilla de "Más vendidos" y los resultados de
// búsqueda -- mismo tamaño de tarjeta en los dos casos, un solo lugar
// para ajustar cuántas columnas caben en cada ancho.
const PRODUCT_GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3'

export function SaleScreen({
  cashSessionId,
  userId,
  role,
  onSaleRecorded,
}: {
  cashSessionId: string
  userId: string
  role: Role | null
  onSaleRecorded?: () => void
}) {
  const {
    products,
    updateProduct,
    loading: productsLoading,
    error: productsError,
    refresh: refreshProducts,
  } = useProducts()
  const {
    items: paymentMethods,
    loading: methodsLoading,
    error: methodsError,
    refresh: refreshMethods,
  } = usePaymentMethods()
  const { customers } = useCustomers()
  const { categories } = useCategories()
  const favorites = useFavoriteProducts(userId)
  const topSellingIds = useTopSellingProducts()
  // La venta en curso vive en un contexto que envuelve las rutas (nunca
  // se desmonta al navegar) -- así el cajero puede ir a consultar
  // Catálogo o Inventario a media venta y volver sin perder el carrito.
  const {
    cart,
    pendingDraft,
    storageError,
    removedLine,
    removeCartLine,
    undoRemoval,
    setCart,
    paymentMethodId,
    setPaymentMethodId,
    cashReceived,
    setCashReceived,
    customerId,
    setCustomerId,
    syncCashSession,
  } = useCart()

  useEffect(() => {
    syncCashSession(cashSessionId)
  }, [cashSessionId, syncCashSession])

  // Mismo corte que el costo en Catálogo (CLAUDE.md §6): un cajero no
  // debe poder tocar precios libremente -- eso reabriría justo lo que la
  // auditoría del 20 de agosto cerró (un cajero forjando el precio para
  // quedarse con la diferencia). Solo quien ya ve costos puede corregir
  // un precio desde la venta en curso.
  const canEditPrice = role === 'owner' || role === 'local_admin'
  const [editingPriceProduct, setEditingPriceProduct] =
    useState<Product | null>(null)

  const [search, setSearch] = useState('')
  // Filtro secundario, opcional -- para cuando el cliente pide "algo de
  // especias" sin saber el nombre exacto. No cambia en nada la búsqueda
  // por texto de siempre: en 'all' (su default) el comportamiento es
  // idéntico al de antes de que existiera este filtro.
  const [filterCategory, setFilterCategory] = useState('all')
  const [granelProduct, setGranelProduct] = useState<Product | null>(null)
  const [granelInitialGrams, setGranelInitialGrams] = useState<
    number | undefined
  >(undefined)
  const [editingWeightLine, setEditingWeightLine] = useState<CartLine | null>(
    null,
  )
  const [scannerOpen, setScannerOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cada negocio marca cuál es su método de pago más usado (es_default en
  // payment_methods, configurable por tenant) -- no se asume "efectivo"
  // en el código, se lee de los datos de cada negocio.
  const defaultMethodId =
    paymentMethods.find((m) => m.is_default)?.id ?? paymentMethods[0]?.id ?? ''

  useEffect(() => {
    if (!paymentMethodId && defaultMethodId) setPaymentMethodId(defaultMethodId)
  }, [defaultMethodId, paymentMethodId, setPaymentMethodId])

  // El cobro (create_sale + ticket) vive aparte -- ver useSubmitSale.
  const {
    total,
    selectedMethod,
    change,
    checkoutDisabled,
    submitting,
    receipt,
    setReceipt,
    handleCheckout,
    lineTotal,
  } = useSubmitSale({
    onSaleRecorded,
    cashSessionId,
    paymentMethods,
    customers,
    catalogReady:
      !productsLoading && !productsError && !methodsLoading && !methodsError,
  })

  const cartListId = useId()
  const {
    ref: cartListRef,
    canScrollStart: cartCanScrollUp,
    canScrollEnd: cartCanScrollDown,
    onScroll: updateCartScrollShadows,
  } = useScrollShadows<HTMLDivElement>({ extraDep: cart })
  const highlightedLine = useCartHighlight(cart, cartListRef)

  // Una búsqueda = un producto agregado = listo para la siguiente -- igual
  // sea por clic o por escaneo, el buscador se limpia y recupera el foco
  // solo, sin que el cajero tenga que volver a tocarlo entre productos.
  const afterAdd = () => {
    setSearch('')
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const activeCustomers = customers.filter((c) => c.active)
  const activeCategories = categories.filter((c) => c.active)

  const [resultLimit, setResultLimit] = useState(20)
  const allResults = useMemo(
    () => searchProducts(products, search, filterCategory),
    [products, search, filterCategory],
  )
  const results = allResults.slice(0, resultLimit)
  const changeSearch = (value: string) => {
    setSearch(value)
    setResultLimit(20)
  }
  const changeCategory = (value: string | null) => {
    setFilterCategory(value ?? 'all')
    setResultLimit(20)
  }

  // Solo se enseña en el estado inactivo (sin búsqueda ni filtro) -- ahí
  // la pantalla quedaba en blanco y es donde de verdad ayuda un atajo,
  // sin restarle nada a la velocidad de buscar/escanear.
  const topProducts = useMemo(
    () =>
      topSellingIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p !== undefined && p.active),
    [topSellingIds, products],
  )

  const addToCart = (
    product: Product,
    weightKg?: number,
    amountMxn?: number,
    pieceQuantity = 1,
  ) => {
    if (product.sold_by_weight) {
      // El peso siempre se captura exacto (báscula o monto pedido) --
      // no tiene sentido "sumar 1" a un producto que se pesa.
      setCart((prev) => [
        ...prev,
        { product, quantity: weightKg ?? 0, amountMxn },
      ])
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

  // Voz llena este mismo carrito. El precio/importe siempre sale de
  // create_sale del lado del servidor a partir del catálogo -- voz
  // nunca manda un precio, solo cantidad/peso/monto, así que un
  // reconocimiento equivocado cobra mal la cantidad pero nunca a un
  // precio forjado (VoiceCommandButton ya exigió confianza de match
  // antes de llegar aquí).
  const handleVoiceAmount = (product: Product, amountMxn: number) => {
    const weightKg = granelWeightKgFromAmount(
      amountMxn,
      product.price,
      product.price_per_100g ?? 0,
    )
    if (weightKg <= 0) {
      toast.error(
        'Este producto todavía no tiene precio -- agrégalo en Catálogo.',
      )
      return
    }
    addToCart(product, weightKg, amountMxn)

    afterAdd()
  }

  const handleVoiceQuantity = (product: Product, quantity: number) => {
    addToCart(product, undefined, undefined, quantity)

    afterAdd()
  }

  // Decisión explícita del dueño (2026-09-14), contra la recomendación
  // original: el peso dicho en voz ("100 gramos") se agrega tal cual,
  // sin pasar por la báscula real -- antes esto siempre abría
  // GranelDialog para que alguien pesara y confirmara. Ver el
  // comentario completo en VoiceCommandButton.tsx.
  const handleVoiceWeight = (product: Product, grams: number) => {
    addToCart(product, grams / 1000)

    afterAdd()
  }

  const handleProductClick = (product: Product) => {
    if (product.sold_by_weight) {
      setGranelInitialGrams(undefined)
      setGranelProduct(product)
      return
    }
    addToCart(product)
    afterAdd()
  }

  const handleOpenManualWeight = (product: Product, initialGrams?: number) => {
    setGranelInitialGrams(initialGrams)
    setGranelProduct(product)
  }

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartLine(cart.findIndex((line) => line.product.id === productId))
      return
    }
    setCart((prev) =>
      prev.map((line) =>
        line.product.id === productId ? { ...line, quantity } : line,
      ),
    )
  }

  // Corrige Catálogo y, de una vez, la línea ya agregada a esta venta --
  // el carrito guarda una copia del producto al momento de agregarlo, así
  // que sin esto el precio nuevo no se vería reflejado hasta la
  // siguiente venta.
  const handleSavePrice = async (
    productId: string,
    price: number,
    pricePer100g: number | null,
  ) => {
    const ok = await updateProduct(productId, {
      price,
      ...(pricePer100g !== null ? { price_per_100g: pricePer100g } : {}),
    })
    if (!ok) return false
    setCart((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) return line
        const nextPricePer100g = pricePer100g ?? line.product.price_per_100g
        return {
          ...line,
          product: { ...line.product, price, price_per_100g: nextPricePer100g },
          // Una línea "por monto" (ej. "$50 de chile") pesaba lo que ese
          // monto alcanzaba al precio viejo -- create_sale deriva el peso
          // real del lado del servidor con el precio ya corregido, así
          // que sin esto el cajero vería en pantalla un peso que ya no es
          // el que de verdad se va a cobrar ni el que hay que pesar.
          quantity:
            line.amountMxn !== undefined
              ? granelWeightKgFromAmount(
                  line.amountMxn,
                  price,
                  nextPricePer100g ?? 0,
                )
              : line.quantity,
        }
      }),
    )
    return true
  }

  const findExactSkuMatch = (code: string) => {
    const query = normalizeSearch(code)
    if (!query) return null
    return (
      products.find(
        (p) => p.active && p.sku && normalizeSearch(p.sku) === query,
      ) ?? null
    )
  }

  const addScannedProduct = (product: Product) => {
    if (product.sold_by_weight) {
      setGranelProduct(product)
      setSearch('')
      return
    }
    addToCart(product)

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
        toast.error(
          'Código no reconocido: ningún producto lo tiene registrado.',
        )
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

  const checkoutLayoutRef = useCheckoutHeight()
  const cartHeadingRef = useRef<HTMLHeadingElement>(null)
  useSaleShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onCheckout: handleCheckout,
    onClearSearch: () => {
      if (document.activeElement === searchInputRef.current) setSearch('')
    },
    checkoutDisabled,
    dialogOpen:
      granelProduct !== null ||
      editingWeightLine !== null ||
      receipt !== null ||
      scannerOpen ||
      editingPriceProduct !== null,
  })

  return (
    <>
      <DraftRecovery
        products={products}
        ready={!productsLoading && !productsError}
      />
      {storageError && (
        <p role="alert" className="text-destructive mb-3 text-sm">
          No se pudo guardar el borrador en este navegador. Mantén esta pestaña
          abierta hasta terminar la venta.
        </p>
      )}
      <LoadError
        message={productsError}
        onRetry={refreshProducts}
        loading={productsLoading}
      />
      <LoadError
        message={methodsError}
        onRetry={refreshMethods}
        loading={methodsLoading}
      />
      <fieldset disabled={!!pendingDraft || submitting} className="contents">
        <div
          ref={checkoutLayoutRef}
          className={`grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px] ${cart.length ? 'pb-32 lg:pb-0' : ''}`}
        >
          <div className="flex min-w-0 flex-col gap-3">
            <div className="bg-background/95 sticky top-2 z-20 flex flex-wrap gap-2 rounded-xl border p-3 shadow-sm backdrop-blur-sm">
              <SearchInput
                ref={searchInputRef}
                value={search}
                onChange={changeSearch}
                onKeyDown={handleSearchKeyDown}
                placeholder="Nombre o código de barras"
                aria-label="Buscar producto por nombre o código"
                containerClassName="min-w-0 basis-full sm:basis-auto sm:flex-1"
                autoFocus
              />

              <VoiceCommandButton
                products={products}
                onAddByAmount={handleVoiceAmount}
                onAddByQuantity={handleVoiceQuantity}
                onAddByWeight={handleVoiceWeight}
                onOpenManualWeight={handleOpenManualWeight}
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
                  ...activeCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                value={filterCategory}
                onValueChange={changeCategory}
              >
                <SelectTrigger
                  aria-label="Filtrar por categoría"
                  className="w-full shrink-0 sm:w-48"
                >
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

            {/* Sin invitación a buscar aquí a propósito: el placeholder del
            buscador ya dice qué hacer, y en la pantalla de mayor uso del
            sistema esa ilustración solo empujaba todo hacia abajo antes
            del primer producto. "Sin resultados" sí se queda completo --
            ahí el cajero necesita saber que algo salió distinto a lo
            esperado, no solo "todavía no escribiste nada". */}
            {productsLoading && products.length === 0 ? (
              <p role="status" className="text-muted-foreground text-sm">
                Cargando productos…
              </p>
            ) : productsError &&
              products.length === 0 ? null : search.trim() === '' &&
              filterCategory === 'all' ? (
              <>
                <FavoriteProductStrip
                  products={products}
                  ids={favorites.ids}
                  onToggle={favorites.toggle}
                  onChoose={handleProductClick}
                />
                {topProducts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                      <TrendingUp className="size-3.5" />
                      Más vendidos
                    </p>
                    <div className={PRODUCT_GRID_CLASS}>
                      {topProducts.map((product, index) => (
                        <ProductResultCard
                          key={product.id}
                          product={product}
                          favorite={favorites.ids.includes(product.id)}
                          onToggleFavorite={() => favorites.toggle(product.id)}
                          rank={index + 1}
                          onClick={() => handleProductClick(product)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
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
              <div className="space-y-3">
                <p role="status" className="text-muted-foreground text-sm">
                  Mostrando {results.length} de {allResults.length} productos
                </p>
                <div className={PRODUCT_GRID_CLASS}>
                  {results.map((product) => (
                    <ProductResultCard
                      key={product.id}
                      product={product}
                      favorite={favorites.ids.includes(product.id)}
                      onToggleFavorite={() => favorites.toggle(product.id)}
                      onClick={() => handleProductClick(product)}
                    />
                  ))}
                </div>
                {results.length < allResults.length && (
                  <Button
                    variant="outline"
                    onClick={() => setResultLimit((limit) => limit + 20)}
                  >
                    Ver más productos
                  </Button>
                )}
              </div>
            )}
          </div>

          <Card
            id="current-sale"
            className="h-fit min-w-0 scroll-mt-4 lg:sticky lg:top-3 lg:h-[var(--sale-panel-height,calc(100dvh-12rem))] lg:gap-2 lg:overflow-hidden"
          >
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center justify-between gap-2">
                <h2
                  ref={cartHeadingRef}
                  tabIndex={-1}
                  className="focus-visible:outline-ring scroll-mt-4 focus-visible:outline-2"
                >
                  Venta actual{' '}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({cart.length} {cart.length === 1 ? 'renglón' : 'renglones'}
                    )
                  </span>
                </h2>
                <CartScrollControls
                  listRef={cartListRef}
                  listId={cartListId}
                  canScrollUp={cartCanScrollUp}
                  canScrollDown={cartCanScrollDown}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {removedLine && (
                <div
                  role="status"
                  className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-lg p-2 text-sm"
                >
                  <span>Se quitó {removedLine.product.name}.</span>
                  <Button variant="outline" onClick={undoRemoval}>
                    Deshacer
                  </Button>
                </div>
              )}
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Aún no hay productos en la venta.
                </p>
              ) : (
                // Scroll propio de la lista, no de toda la página -- con
                // muchas líneas, el carrito (sticky) podía crecer más alto
                // que la pantalla y el Total/Cobrar quedaban fuera de vista
                // hasta desplazar toda la página, mientras la columna de
                // productos ya había terminado y dejaba hueco vacío al lado.
                // El cobro queda fuera del scroll. Con texto grande, el cuerpo
                // también puede desplazarse sin ocultar la acción principal.
                <div className="relative border-y lg:min-h-36 lg:flex-1">
                  <div
                    ref={cartListRef}
                    id={cartListId}
                    role="region"
                    aria-label="Productos de la venta"
                    tabIndex={0}
                    onScroll={updateCartScrollShadows}
                    className="flex max-h-[40dvh] flex-col gap-1 overflow-y-auto overscroll-contain py-2 pr-1 lg:absolute lg:inset-0 lg:max-h-none"
                  >
                    {cart.map((line, index) => (
                      <div
                        key={`${line.product.id}-${index}`}
                        className={`flex items-start gap-2.5 rounded-md p-2 ${line === highlightedLine ? 'bg-brand-gold/15 ring-brand-gold ring-1 ring-inset' : ''}`}
                      >
                        {/* Miniatura -- mismo estilo y placeholder que la
                        rejilla de productos, no solo decorativa: es una
                        segunda confirmación visual antes de cobrar, además
                        del nombre a todo el ancho, para distinguir de un
                        vistazo presentaciones parecidas (dos "Chipotles
                        Adobados..." con gramaje y precio distinto). */}
                        {line.product.image_url ? (
                          <img
                            src={line.product.image_url}
                            alt=""
                            className="border-border size-10 shrink-0 rounded-md border object-cover"
                          />
                        ) : (
                          <div className="border-border bg-muted flex size-10 shrink-0 items-center justify-center rounded-md border">
                            <Package className="text-muted-foreground size-4" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          {/* Nombre en su propia fila, a todo el ancho
                          disponible -- con nombres largos que comparten
                          prefijo, compartir la fila con el stepper y el
                          precio dejaba tan poco ancho que se veían
                          idénticos aunque fueran presentaciones distintas.
                          En la pantalla donde se cobra dinero real, poder
                          distinguirlos pesa más que una fila más compacta. */}
                          <p className="line-clamp-2 text-sm font-medium">
                            {line.product.name}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-muted-foreground flex items-center gap-1 text-xs">
                              {line.product.sold_by_weight
                                ? `${line.amountMxn !== undefined ? `Por ${formatCurrency(line.amountMxn)} · ` : ''}${Math.round(line.quantity * 1000)} g`
                                : `${formatCurrency(line.product.price)} c/u`}
                              {line.product.sold_by_weight && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Editar peso o monto de ${line.product.name}`}
                                  onClick={() => setEditingWeightLine(line)}
                                >
                                  {line.amountMxn !== undefined
                                    ? 'Editar monto'
                                    : 'Editar peso'}
                                </Button>
                              )}
                              {canEditPrice && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Más acciones de ${line.product.name}`}
                                      />
                                    }
                                  >
                                    <MoreHorizontal className="size-3" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setEditingPriceProduct(line.product)
                                      }
                                    >
                                      Corregir precio del catálogo
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {!line.product.sold_by_weight && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label={`Restar una unidad de ${line.product.name}`}
                                    onClick={() =>
                                      setQuantity(
                                        line.product.id,
                                        line.quantity - 1,
                                      )
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
                                    aria-label={`Sumar una unidad de ${line.product.name}`}
                                    onClick={() =>
                                      setQuantity(
                                        line.product.id,
                                        line.quantity + 1,
                                      )
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
                                aria-label={`Eliminar ${line.product.name} de la venta`}
                                onClick={() => removeCartLine(index)}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex shrink-0 flex-col gap-3">
                <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg p-3 text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-foreground text-2xl tabular-nums">
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Método de pago, efectivo, cliente y el botón de cobrar solo
              aparecen con algo en el carrito -- con $0.00 no hay nada que
              cobrar, y mostrarlos igual era ruido antes del primer
              producto en la pantalla que más se usa del sistema. */}
                {cart.length > 0 && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="sale-payment-method">
                        Método de pago
                      </Label>
                      <Select
                        items={paymentMethods.map((m) => ({
                          value: m.id,
                          label: m.name,
                        }))}
                        value={paymentMethodId}
                        onValueChange={(value) =>
                          setPaymentMethodId(value ?? '')
                        }
                      >
                        <SelectTrigger
                          id="sale-payment-method"
                          className="w-full"
                        >
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
                      <CashPaymentFields
                        total={total}
                        value={cashReceived}
                        change={change}
                        onChange={setCashReceived}
                      />
                    )}

                    {/* Cliente va al final a propósito: en un negocio de mostrador
                  como Del Campo casi toda venta es anónima -- método de pago
                  y efectivo recibido se tocan siempre, cliente solo a veces.
                  El orden visual debe reflejar qué tan seguido se usa cada
                  campo, no al revés (CLAUDE.md: velocidad del cajero primero). */}
                    <details className="rounded-lg border p-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        {customerId === NO_CUSTOMER
                          ? 'Asignar cliente (opcional)'
                          : 'Cliente: ' +
                            (activeCustomers.find(
                              (customer) => customer.id === customerId,
                            )?.name ?? 'Seleccionado')}
                      </summary>
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Label htmlFor="sale-customer">
                          Cliente (opcional)
                        </Label>
                        <Select
                          items={[
                            { value: NO_CUSTOMER, label: 'Sin cliente' },
                            ...activeCustomers.map((c) => ({
                              value: c.id,
                              label: c.name,
                            })),
                          ]}
                          value={customerId}
                          onValueChange={(value) =>
                            setCustomerId(value ?? NO_CUSTOMER)
                          }
                        >
                          <SelectTrigger id="sale-customer" className="w-full">
                            <SelectValue placeholder="Sin cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_CUSTOMER}>
                              Sin cliente
                            </SelectItem>
                            {activeCustomers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </details>
                  </>
                )}
              </div>
            </CardContent>
            {cart.length > 0 && (
              <CardFooter className="bg-card shrink-0 border-0 pt-3">
                <Button
                  className="min-h-12 w-full text-base"
                  onClick={handleCheckout}
                  disabled={checkoutDisabled}
                >
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
              </CardFooter>
            )}
          </Card>

          {cart.length > 0 && (
            <MobileCartSummary
              total={total}
              canCheckout={!checkoutDisabled}
              submitting={submitting}
              onCheckout={handleCheckout}
              onOpen={() => {
                cartHeadingRef.current?.scrollIntoView({ block: 'start' })
                cartHeadingRef.current?.focus({ preventScroll: true })
              }}
            />
          )}

          <GranelDialog
            product={granelProduct}
            initialGrams={granelInitialGrams}
            onOpenChange={(open) => {
              if (!open) {
                setGranelProduct(null)
                setGranelInitialGrams(undefined)
              }
            }}
            onConfirm={(weightKg, amountMxn) => {
              if (granelProduct) {
                addToCart(granelProduct, weightKg, amountMxn)
              }
              setGranelProduct(null)
              setGranelInitialGrams(undefined)
              afterAdd()
            }}
          />

          <GranelDialog
            product={editingWeightLine?.product ?? null}
            initialGrams={
              editingWeightLine
                ? Math.round(editingWeightLine.quantity * 1000)
                : undefined
            }
            initialAmount={editingWeightLine?.amountMxn}
            editing
            onOpenChange={(open) => {
              if (!open) setEditingWeightLine(null)
            }}
            onConfirm={(quantity, amountMxn) => {
              setCart((previous) =>
                previous.map((line) =>
                  line === editingWeightLine
                    ? { ...line, quantity, amountMxn }
                    : line,
                ),
              )
              setEditingWeightLine(null)
            }}
          />

          <ReceiptDialog
            receipt={receipt}
            onClose={() => setReceipt(null)}
            returnFocus={searchInputRef}
          />

          <BarcodeScannerDialog
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onDetected={handleCameraScan}
          />

          <EditCartPriceDialog
            product={editingPriceProduct}
            onOpenChange={(open) => {
              if (!open) setEditingPriceProduct(null)
            }}
            onSave={handleSavePrice}
          />
        </div>
      </fieldset>
    </>
  )
}
