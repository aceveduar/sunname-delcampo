import { useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  FileImage,
  ImageOff,
  LayoutGrid,
  Package,
  PackageSearch,
  ScanBarcode,
  SlidersHorizontal,
  Trash2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Tag,
  TableIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationControls } from '@/components/PaginationControls'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import type { Database } from '@/lib/database.types'
import { useProducts, type Product } from './useProducts'
import { useProductCosts } from './useProductCosts'
import { isEnPerdida } from '@/lib/pricing'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'
import { useProductFilters } from './useProductFilters'
import { ProductForm } from './ProductForm'
import { LabelPrintDialog } from './LabelPrintDialog'
import { PriceSheetDialog } from './PriceSheetDialog'
import { StockAdjustDialog } from './StockAdjustDialog'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'

type Role = Database['public']['Enums']['user_role']
const CAN_MANAGE_PRODUCTS: Role[] = ['owner', 'local_admin']

export function ProductsTab({ role }: { role: Role | null }) {
  const {
    products,
    loading,
    createProduct,
    updateProduct,
    updatePrices,
    toggleActive,
    deleteProduct,
    fetchCost,
  } = useProducts()
  const { categories } = useCategories()
  const { units } = useUnits()
  const { costsById } = useProductCosts()

  const canManage = role !== null && CAN_MANAGE_PRODUCTS.includes(role)
  const enPerdida = (product: Product) => {
    const cost = costsById.get(product.id)
    return cost !== undefined && isEnPerdida({ active: product.active, price: product.price, cost })
  }
  // Un producto sin precio debería quedar inactivo hasta que se le ponga
  // uno (regla ya usada en todo el sistema -- venta por monto, GranelDialog,
  // la captura de precios por foto activa solo al confirmar precio real).
  // Si de todos modos quedó activo con precio en cero -- por ejemplo, se
  // activó a mano sin querer -- Caja ya lo bloquea con "Sin precio", pero
  // nada lo señalaba aquí, donde se administra el catálogo.
  const sinPrecioActivo = (product: Product) => product.active && product.price === 0
  // Borrar del catálogo es decisión de dueño: un administrador de local
  // desactiva, no borra (CLAUDE.md §6). El servidor lo vuelve a exigir --
  // esconder el botón es comodidad, no la seguridad.
  const canDelete = role === 'owner'

  // Búsqueda, los 4 filtros y paginación -- ver useProductFilters.
  const {
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterActive,
    setFilterActive,
    filterGranel,
    setFilterGranel,
    filterNoPrice,
    setFilterNoPrice,
    filtersOpen,
    setFiltersOpen,
    categoryFilterItems,
    statusFilterItems,
    granelFilterItems,
    filtersActive,
    clearFilters,
    filteredProducts,
    pageItems,
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
  } = useProductFilters(products, categories)

  // Alta/edición -- el formulario completo vive en ProductForm.
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const openCreate = () => {
    setEditingProduct(null)
    setProductFormOpen(true)
  }
  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setProductFormOpen(true)
  }

  // Se guarda el id, no el objeto: así, cuando se genera un código dentro
  // del diálogo, el refresh de useProducts trae el producto actualizado y
  // el diálogo lo ve sin quedarse con el snapshot viejo (sin SKU).
  const [labelProductId, setLabelProductId] = useState<string | null>(null)
  const [stockAdjustProductId, setStockAdjustProductId] = useState<
    string | null
  >(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const labelProduct = products.find((p) => p.id === labelProductId) ?? null
  const stockAdjustProduct =
    products.find((p) => p.id === stockAdjustProductId) ?? null
  const [searchScannerOpen, setSearchScannerOpen] = useState(false)
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)
  // En pantallas chicas la tabla obliga a hacer scroll lateral para ver
  // precio/estado/acciones; tarjetas en 2 columnas se ve todo sin cortes.
  const [view, setView] = useState<'table' | 'cards'>(() =>
    window.innerWidth < 640 ? 'cards' : 'table',
  )

  // Modo "Editar precios": captura rápida de varios precios a la vez
  // (filtrando por categoría, por ejemplo, para solo los productos que
  // el dueño acaba de reponer) sin abrir el diálogo completo uno por
  // uno. Solo en vista de tabla -- es la vista donde tiene sentido
  // capturar varios números en fila.
  const [priceEditMode, setPriceEditMode] = useState(false)
  const [priceEdits, setPriceEdits] = useState<
    Record<string, { price: string; price_per_100g: string }>
  >({})
  const [savingPrices, setSavingPrices] = useState(false)
  const pendingPriceChanges = Object.keys(priceEdits).length

  const setPriceEdit = (
    productId: string,
    field: 'price' | 'price_per_100g',
    value: string,
  ) => {
    setPriceEdits((prev) => {
      const current = prev[productId] ?? { price: '', price_per_100g: '' }
      return { ...prev, [productId]: { ...current, [field]: value } }
    })
  }

  const cancelPriceEdits = () => {
    setPriceEdits({})
    setPriceEditMode(false)
  }

  const savePriceEdits = async () => {
    const changes = Object.entries(priceEdits)
      .map(([id, edit]) => {
        const product = products.find((p) => p.id === id)
        if (!product) return null
        const price = edit.price === '' ? product.price : Number(edit.price)
        const pricePer100g = product.sold_by_weight
          ? edit.price_per_100g === ''
            ? (product.price_per_100g ?? 0)
            : Number(edit.price_per_100g)
          : null
        if (!Number.isFinite(price) || price < 0) return null
        if (pricePer100g !== null && (!Number.isFinite(pricePer100g) || pricePer100g < 0))
          return null
        return { id, price, price_per_100g: pricePer100g }
      })
      .filter((c): c is { id: string; price: number; price_per_100g: number | null } => c !== null)

    if (changes.length === 0) return
    setSavingPrices(true)
    const ok = await updatePrices(changes)
    setSavingPrices(false)
    if (ok) {
      setPriceEdits({})
      setPriceEditMode(false)
    }
  }

  const activeUnits = units.filter((u) => u.active)
  // La lista de unidades se ordena alfabéticamente por nombre -- sin esto,
  // cualquier unidad que quede primera en ese orden (ej. "Costal") se
  // convierte en el default de todo producto nuevo, sin relación alguna
  // con qué tan común es esa unidad. "Pieza" es el default neutral más
  // razonable para un producto genérico; si el negocio no la tiene dada
  // de alta, cae a la primera unidad disponible.
  const defaultUnitId =
    activeUnits.find((u) => u.code === 'PZA')?.id ?? activeUnits[0]?.id ?? ''

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '—'
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? '—'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Productos que vendes, con su precio, categoría y unidad.
        </p>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {priceEditMode ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelPriceEdits}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={savePriceEdits}
                  disabled={pendingPriceChanges === 0 || savingPrices}
                >
                  {savingPrices
                    ? 'Guardando…'
                    : pendingPriceChanges === 0
                      ? 'Guardar cambios'
                      : `Guardar ${pendingPriceChanges} cambio${pendingPriceChanges === 1 ? '' : 's'}`}
                </Button>
              </>
            ) : (
              // Solo visible en sm+: en mobile las mismas tres acciones
              // viven en el menú "+" junto al buscador, no aquí arriba.
              <div className="hidden gap-2 sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setView('table')
                    setPriceEditMode(true)
                  }}
                >
                  <Pencil /> Editar precios
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPriceSheetOpen(true)}
                >
                  <FileImage /> Precios por foto
                </Button>
                <Button
                  onClick={openCreate}
                  size="sm"
                  disabled={activeUnits.length === 0}
                >
                  <Plus /> Nuevo producto
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {activeUnits.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Antes de dar de alta productos, crea al menos una unidad de medida en
          la pestaña "Unidades".
        </p>
      )}

      {/* Sin justify-between: con los botones nuevos, si la fila se ve
          obligada a bajar de línea en mobile, space-between separaba lo
          que quedaba en cada línea a los extremos en vez de agruparlo. */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar producto por nombre o SKU…"
          containerClassName="max-w-sm min-w-0 flex-1 sm:min-w-[300px]"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Buscar por código de barras con la cámara"
          onClick={() => setSearchScannerOpen(true)}
        >
          <ScanBarcode />
        </Button>
        {/* Filtros solo en mobile: en sm+ los 4 controles ya están
            visibles justo abajo, no hace falta un botón para abrirlos. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative sm:hidden"
          aria-label="Filtros"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal />
          {filtersActive && (
            <span className="bg-primary absolute top-1.5 right-1.5 size-1.5 rounded-full" />
          )}
        </Button>
        {/* Acciones (Nuevo producto/Editar precios/Precios por foto) solo
            en mobile: en sm+ ya están arriba como botones completos.
            Sin variant="outline" a propósito -- relleno, como ya es
            "Nuevo producto" en escritorio (el único de los tres que no
            es outline), para que se distinga de los íconos neutros de
            buscar/escanear/filtro que tiene al lado. */}
        {canManage && !priceEditMode && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon"
                  aria-label="Acciones de catálogo"
                  className="sm:hidden"
                />
              }
            >
              <Plus />
            </DropdownMenuTrigger>
            {/* w-56 explícito: el ancho por default del menú sigue al
                del botón que lo abre (w-(--anchor-width) en
                dropdown-menu.tsx) -- con un trigger de solo ícono
                (32px), "Precios por foto" partía en dos líneas y el
                ícono quedaba descentrado contra el texto. */}
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="py-2"
                onClick={openCreate}
                disabled={activeUnits.length === 0}
              >
                <Plus /> Nuevo producto
              </DropdownMenuItem>
              <DropdownMenuItem
                className="py-2"
                onClick={() => {
                  setView('table')
                  setPriceEditMode(true)
                }}
              >
                <Pencil /> Editar precios
              </DropdownMenuItem>
              <DropdownMenuItem
                className="py-2"
                onClick={() => setPriceSheetOpen(true)}
              >
                <FileImage /> Precios por foto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* Solo en sm+: en mobile la tabla obliga a scroll lateral, así
            que ahí siempre es tarjetas, sin selector que ofrezca la
            opción peor. "Editar precios" (que sí necesita tabla) sigue
            forzando la vista por código, sin depender de este botón. */}
        <div className="border-border hidden items-center gap-1 rounded-lg border p-0.5 sm:flex">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setView('table')}
            aria-label="Vista de tabla"
          >
            <TableIcon />
          </Button>
          <Button
            variant={view === 'cards' ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => setView('cards')}
            disabled={priceEditMode}
            aria-label="Vista de tarjetas"
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      {/* Solo en sm+: en mobile estos mismos 4 controles viven en la
          hoja de "Filtros" de abajo, para no apilar seis controles
          antes del primer producto. */}
      <div className="hidden gap-3 sm:flex sm:flex-wrap sm:items-center">
        <Select
          items={categoryFilterItems}
          value={filterCategory}
          onValueChange={(value) => setFilterCategory(value ?? 'all')}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            {categoryFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={statusFilterItems}
          value={filterActive}
          onValueChange={(value) =>
            setFilterActive((value as typeof filterActive) ?? 'all')
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            {statusFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={granelFilterItems}
          value={filterGranel}
          onValueChange={(value) =>
            setFilterGranel((value as typeof filterGranel) ?? 'all')
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="A granel: todos" />
          </SelectTrigger>
          <SelectContent>
            {granelFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={filterNoPrice} onCheckedChange={setFilterNoPrice} />
          Sin precio
        </label>
      </div>

      {view === 'cards' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card flex flex-col overflow-hidden rounded-xl border"
              >
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="flex flex-col gap-1.5 p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="mt-1 h-4 w-1/3" />
                </div>
              </div>
            ))}
          {!loading && filteredProducts.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={PackageSearch}
                title={
                  products.length === 0
                    ? 'Aún no hay productos en el catálogo'
                    : 'Sin resultados'
                }
                description={
                  products.length === 0
                    ? 'Da de alta tu primer producto para empezar a vender.'
                    : `No se encontraron productos para "${search}".`
                }
              />
            </div>
          )}
          {pageItems.map((product) => (
            <div
              key={product.id}
              className="border-border bg-card flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
            >
              <div className="bg-muted relative aspect-square w-full">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  // Package, no ImageOff: en un catálogo apenas cargando
                  // fotos, este placeholder es lo que se ve en casi toda
                  // la cuadrícula -- una imagen "tachada" se lee como un
                  // error, no como "todavía sin foto".
                  <div className="text-muted-foreground/50 flex size-full items-center justify-center">
                    <Package className="size-10" />
                  </div>
                )}
                {!product.active && (
                  <Badge variant="secondary" className="absolute top-2 right-2">
                    Inactivo
                  </Badge>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 p-3">
                <p className="leading-tight font-medium">{product.name}</p>
                <p className="text-muted-foreground text-xs">
                  {categoryName(product.category_id)}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {product.sold_by_weight ? (
                    <>
                      {formatCurrency(product.price)}/kg
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · {formatCurrency(product.price_per_100g ?? 0)}/100g
                      </span>
                    </>
                  ) : (
                    formatCurrency(product.price)
                  )}
                </p>
                {canManage && enPerdida(product) && (
                  <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                    <AlertTriangle className="size-3" /> En pérdida
                  </p>
                )}
                {canManage && sinPrecioActivo(product) && (
                  <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                    <AlertTriangle className="size-3" /> Activo sin precio
                  </p>
                )}
                {canManage && (
                  // Solo íconos en tarjeta (a diferencia de la tabla, que
                  // sí tiene ancho de sobra): tres textos no cabían en una
                  // línea y "Etiqueta" se iba sola a la siguiente.
                  // justify-between en vez de un gap fijo: reparte los tres
                  // a lo ancho de la tarjeta (se ve intencional, no
                  // amontonado) y de paso separa más los puntos de toque.
                  <div className="border-border mt-2 flex justify-between border-t pt-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar producto"
                      onClick={() => openEdit(product)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={product.active ? 'Desactivar producto' : 'Activar producto'}
                      onClick={() => toggleActive(product)}
                    >
                      {/* El ícono muestra la acción del clic, no el estado
                          actual (como play/pausa): activo -> se va a
                          apagar, inactivo -> se va a encender. */}
                      {product.active ? <PowerOff /> : <Power />}
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Borrar producto"
                        onClick={() => setDeleteTarget(product)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Imprimir etiqueta"
                      onClick={() => setLabelProductId(product.id)}
                    >
                      <Tag />
                    </Button>
                    {product.track_inventory && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Ajustar existencia"
                        onClick={() => setStockAdjustProductId(product.id)}
                      >
                        <Boxes />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              {canManage && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableSkeletonRows rows={6} columns={canManage ? 8 : 7} />
            )}
            {!loading && filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 8 : 7}>
                  <EmptyState
                    icon={PackageSearch}
                    title={
                      products.length === 0
                        ? 'Aún no hay productos en el catálogo'
                        : 'Sin resultados'
                    }
                    description={
                      products.length === 0
                        ? 'Da de alta tu primer producto para empezar a vender.'
                        : `No se encontraron productos para "${search}".`
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      className="border-border size-9 min-w-9 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground border-border flex size-9 items-center justify-center rounded-md border">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.sku ?? '—'}</TableCell>
                <TableCell>{categoryName(product.category_id)}</TableCell>
                <TableCell>{unitCode(product.unit_id)}</TableCell>
                <TableCell>
                  {priceEditMode ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        autoComplete="off"
                        className="h-7 w-20"
                        value={priceEdits[product.id]?.price ?? String(product.price)}
                        onChange={(event) =>
                          setPriceEdit(product.id, 'price', event.target.value)
                        }
                      />
                      {product.sold_by_weight && (
                        <>
                          <span className="text-muted-foreground text-xs">/100g</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            autoComplete="off"
                            className="h-7 w-20"
                            value={
                              priceEdits[product.id]?.price_per_100g ??
                              String(product.price_per_100g ?? 0)
                            }
                            onChange={(event) =>
                              setPriceEdit(product.id, 'price_per_100g', event.target.value)
                            }
                          />
                        </>
                      )}
                    </div>
                  ) : product.sold_by_weight ? (
                    <span>
                      {formatCurrency(product.price)}/kg ·{' '}
                      {formatCurrency(product.price_per_100g ?? 0)}/100g
                    </span>
                  ) : (
                    formatCurrency(product.price)
                  )}
                  {!priceEditMode && canManage && enPerdida(product) && (
                    <p className="text-destructive mt-0.5 flex items-center gap-1 text-xs font-medium">
                      <AlertTriangle className="size-3" /> En pérdida
                    </p>
                  )}
                  {!priceEditMode && canManage && sinPrecioActivo(product) && (
                    <p className="text-destructive mt-0.5 flex items-center gap-1 text-xs font-medium">
                      <AlertTriangle className="size-3" /> Activo sin precio
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={product.active ? 'default' : 'secondary'}>
                    {product.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="flex justify-end gap-2 text-right">
                    {!priceEditMode && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(product)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(product)}
                        >
                          {product.active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLabelProductId(product.id)}
                        >
                          Etiqueta
                        </Button>
                        {product.track_inventory && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setStockAdjustProductId(product.id)
                            }
                          >
                            Existencia
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(product)}
                          >
                            Borrar
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <PaginationControls
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <ProductForm
        product={editingProduct}
        open={productFormOpen}
        onOpenChange={setProductFormOpen}
        categories={categories}
        units={units}
        defaultUnitId={defaultUnitId}
        createProduct={createProduct}
        updateProduct={updateProduct}
        fetchCost={fetchCost}
      />

      <PriceSheetDialog
        open={priceSheetOpen}
        onOpenChange={setPriceSheetOpen}
        products={products}
        units={activeUnits}
        onApply={updatePrices}
        onCreateProduct={createProduct}
      />

      {/* Hoja de filtros de mobile: mismos 4 controles que la fila de
          sm+, en un diálogo aparte para no forzar el scroll antes de ver
          un producto. "Aplicar" solo cierra -- los filtros ya actúan en
          vivo, igual que en escritorio. */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <Select
                items={categoryFilterItems}
                value={filterCategory}
                onValueChange={(value) => setFilterCategory(value ?? 'all')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  {categoryFilterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select
                items={statusFilterItems}
                value={filterActive}
                onValueChange={(value) =>
                  setFilterActive((value as typeof filterActive) ?? 'all')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Venta a granel</Label>
              <Select
                items={granelFilterItems}
                value={filterGranel}
                onValueChange={(value) =>
                  setFilterGranel((value as typeof filterGranel) ?? 'all')
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="A granel: todos" />
                </SelectTrigger>
                <SelectContent>
                  {granelFilterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              Sin precio
              <Switch
                checked={filterNoPrice}
                onCheckedChange={setFilterNoPrice}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={clearFilters}
              disabled={!filtersActive}
            >
              Limpiar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Aplicar filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LabelPrintDialog
        product={labelProduct}
        onOpenChange={(open) => {
          if (!open) setLabelProductId(null)
        }}
        onAssignSku={(id, sku) => updateProduct(id, { sku })}
      />

      <StockAdjustDialog
        product={stockAdjustProduct}
        unitLabel={
          stockAdjustProduct ? unitCode(stockAdjustProduct.unit_id) : ''
        }
        onOpenChange={(open) => {
          if (!open) setStockAdjustProductId(null)
        }}
        onDone={() => {}}
      />

      <BarcodeScannerDialog
        open={searchScannerOpen}
        onOpenChange={setSearchScannerOpen}
        onDetected={setSearch}
      />

      {/* Borrar es irreversible, así que se confirma nombrando el producto:
          en una lista larga es fácil apretar el renglón de al lado. No se
          promete que vaya a funcionar -- si el producto ya tiene ventas o
          compras, el servidor lo rechaza y aquí se ve el motivo. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Borrar producto</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Se va a borrar <span className="font-semibold">{deleteTarget?.name}</span>{' '}
              del catálogo. No se puede deshacer.
            </p>
            <p className="text-muted-foreground">
              Solo se puede borrar un producto que nunca se vendió, ni entró a
              inventario, ni se compró. Si ya tiene historia, el sistema no lo va a
              permitir y lo correcto es desactivarlo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return
                setDeleting(true)
                const ok = await deleteProduct(deleteTarget.id)
                setDeleting(false)
                if (ok) setDeleteTarget(null)
              }}
            >
              {deleting ? 'Borrando…' : 'Borrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
