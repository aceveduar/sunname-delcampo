import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Boxes,
  ImageOff,
  LayoutGrid,
  Package,
  PackageSearch,
  ScanBarcode,
  Trash2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Tag,
  TableIcon,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { compressImage } from '@/lib/image'
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
import { normalizeSearch, toCode, toTitleCase } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'
import type { Database } from '@/lib/database.types'
import { useProducts, type Product } from './useProducts'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'
import { useRegisterMovement } from '@/features/inventory/useRegisterMovement'
import { LabelPrintDialog } from './LabelPrintDialog'
import { PriceSheetDialog } from './PriceSheetDialog'
import { StockAdjustDialog } from './StockAdjustDialog'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'

const NO_CATEGORY = 'none'

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

  const canManage = role !== null && CAN_MANAGE_PRODUCTS.includes(role)
  // Borrar del catálogo es decisión de dueño: un administrador de local
  // desactiva, no borra (CLAUDE.md §6). El servidor lo vuelve a exigir --
  // esconder el botón es comodidad, no la seguridad.
  const canDelete = role === 'owner'

  const [editing, setEditing] = useState<Product | null>(null)
  const [editingCost, setEditingCost] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
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
  const registerInitialStock = useRegisterMovement(() => {})
  const [skuScannerOpen, setSkuScannerOpen] = useState(false)
  const [searchScannerOpen, setSearchScannerOpen] = useState(false)
  const skuInputRef = useRef<HTMLInputElement>(null)
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [unitId, setUnitId] = useState<string>('')
  const [trackInventory, setTrackInventory] = useState(true)
  const [soldByWeight, setSoldByWeight] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [filterGranel, setFilterGranel] = useState<'all' | 'yes' | 'no'>('all')
  const [filterNoPrice, setFilterNoPrice] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [uploading, setUploading] = useState(false)
  // En pantallas chicas la tabla obliga a hacer scroll lateral para ver
  // precio/estado/acciones; tarjetas en 2 columnas se ve todo sin cortes.
  const [view, setView] = useState<'table' | 'cards'>(() =>
    window.innerWidth < 640 ? 'cards' : 'table',
  )
  const imageInputRef = useRef<HTMLInputElement>(null)

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
  const activeCategories = categories.filter((c) => c.active)
  // La lista de unidades se ordena alfabéticamente por nombre -- sin esto,
  // cualquier unidad que quede primera en ese orden (ej. "Costal") se
  // convierte en el default de todo producto nuevo, sin relación alguna
  // con qué tan común es esa unidad. "Pieza" es el default neutral más
  // razonable para un producto genérico; si el negocio no la tiene dada
  // de alta, cae a la primera unidad disponible.
  const defaultUnitId =
    activeUnits.find((u) => u.code === 'PZA')?.id ?? activeUnits[0]?.id ?? ''

  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search)
    return products.filter((p) => {
      if (
        query &&
        !normalizeSearch(p.name).includes(query) &&
        !(p.sku && normalizeSearch(p.sku).includes(query))
      )
        return false
      if (filterCategory === NO_CATEGORY && p.category_id) return false
      if (
        filterCategory !== 'all' &&
        filterCategory !== NO_CATEGORY &&
        p.category_id !== filterCategory
      )
        return false
      if (filterActive === 'active' && !p.active) return false
      if (filterActive === 'inactive' && p.active) return false
      if (filterGranel === 'yes' && !p.sold_by_weight) return false
      if (filterGranel === 'no' && p.sold_by_weight) return false
      if (filterNoPrice && p.price !== 0) return false
      return true
    })
  }, [products, search, filterCategory, filterActive, filterGranel, filterNoPrice])

  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filteredProducts)

  const openCreate = () => {
    setEditing(null)
    setEditingCost(0)
    setCategoryId(NO_CATEGORY)
    setUnitId(defaultUnitId)
    setTrackInventory(true)
    setSoldByWeight(false)
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(false)
    setDialogOpen(true)
  }

  const openEdit = async (product: Product) => {
    const cost = await fetchCost(product.id)
    setEditing(product)
    setEditingCost(cost ?? 0)
    setCategoryId(product.category_id ?? NO_CATEGORY)
    setUnitId(product.unit_id)
    setTrackInventory(product.track_inventory)
    setSoldByWeight(product.sold_by_weight)
    setImageFile(null)
    setImagePreview(product.image_url)
    setRemoveImage(false)
    setDialogOpen(true)
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setRemoveImage(true)
  }

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '—'
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? '—'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!unitId) return

    // event.currentTarget deja de ser válido en cuanto el handler cruza un
    // await (el navegador lo limpia al terminar el despacho síncrono del
    // evento) -- hay que capturarlo antes de subir la imagen.
    const formEl = event.currentTarget

    let imageUrl = removeImage ? null : (editing?.image_url ?? null)

    if (imageFile) {
      setUploading(true)
      const compressed = await compressImage(imageFile)
      const ext = compressed.name.split('.').pop() ?? 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, compressed)
      setUploading(false)

      if (uploadError) {
        reportError('No se pudo subir la imagen', uploadError)
        return
      }
      imageUrl = supabase.storage.from('product-images').getPublicUrl(path)
        .data.publicUrl
    }

    const form = new FormData(formEl)
    const sku = toCode(String(form.get('sku') ?? ''))
    const values = {
      sku: sku || null,
      name: toTitleCase(String(form.get('name') ?? '')),
      description: String(form.get('description') ?? '').trim() || null,
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
      unit_id: unitId,
      price: Number(form.get('price') ?? 0),
      cost: Number(form.get('cost') ?? 0),
      track_inventory: trackInventory,
      sold_by_weight: soldByWeight,
      price_per_100g: soldByWeight
        ? Number(form.get('price_per_100g') ?? 0)
        : null,
      image_url: imageUrl,
    }

    if (editing) {
      const ok = await updateProduct(editing.id, values)
      if (ok) setDialogOpen(false)
      return
    }

    const newId = await createProduct(values)
    if (!newId) return

    // Existencia inicial es opcional y solo aplica al dar de alta: no se
    // guarda como campo del producto, dispara el mismo movimiento de
    // entrada que ya registra Inventario, para no crear un segundo
    // lugar donde "la cantidad" pueda desincronizarse de su bitácora.
    const initialStock = Number(form.get('initial_stock') ?? 0)
    if (trackInventory && initialStock > 0) {
      await registerInitialStock({
        productId: newId,
        type: 'in',
        quantity: initialStock,
        notes: 'Existencia inicial',
      })
    }
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Productos que vendes, con su precio, categoría y unidad.
        </p>
        {canManage && (
          // flex-wrap: "Editar precios" + "Precios por foto" + "Nuevo
          // producto" (cada uno con ícono + texto) no caben en una sola
          // fila en un celular -- sin poder bajar de línea, empujaban
          // toda la página más ancha que la pantalla.
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
              <>
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
                <PriceSheetDialog
                  products={products}
                  units={activeUnits}
                  onApply={updatePrices}
                  onCreateProduct={createProduct}
                />
                <Button
                  onClick={openCreate}
                  size="sm"
                  disabled={activeUnits.length === 0}
                >
                  <Plus /> Nuevo producto
                </Button>
              </>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar producto por nombre o SKU…"
          containerClassName="max-w-sm min-w-[300px] flex-1"
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
        <div className="border-border flex items-center gap-1 rounded-lg border p-0.5">
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

      {/* Grid de 2 columnas en mobile -- con ancho fijo por selector
          (pensado para escritorio) el flex-wrap de antes los acomodaba
          como podía, dejando "A granel" solo en su fila con un hueco
          enorme antes de "Sin precio". En sm+ vuelve a fila horizontal,
          cada selector con su ancho de siempre. */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <Select
          items={[
            { value: 'all', label: 'Todas las categorías' },
            { value: NO_CATEGORY, label: 'Sin categoría' },
            ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={filterCategory}
          onValueChange={(value) => setFilterCategory(value ?? 'all')}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
            {activeCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={[
            { value: 'all', label: 'Todos los estados' },
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
          ]}
          value={filterActive}
          onValueChange={(value) =>
            setFilterActive((value as typeof filterActive) ?? 'all')
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          items={[
            { value: 'all', label: 'A granel: todos' },
            { value: 'yes', label: 'Solo a granel' },
            { value: 'no', label: 'Solo precio fijo' },
          ]}
          value={filterGranel}
          onValueChange={(value) =>
            setFilterGranel((value as typeof filterGranel) ?? 'all')
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="A granel: todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">A granel: todos</SelectItem>
            <SelectItem value="yes">Solo a granel</SelectItem>
            <SelectItem value="no">Solo precio fijo</SelectItem>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar producto' : 'Nuevo producto'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[70vh] flex-col overflow-hidden"
          >
            <div className="-mx-1 flex flex-col gap-4 overflow-x-hidden overflow-y-auto px-1 py-1">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-image">Foto (opcional)</Label>
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt=""
                      className="border-border size-16 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground/50 border-border flex size-16 shrink-0 items-center justify-center rounded-md border">
                      <Package className="size-6" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={imageInputRef}
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {imagePreview ? 'Cambiar foto' : 'Subir foto'}
                    </Button>
                    {imagePreview && (
                      // "Ghost" sin más era casi invisible junto al botón
                      // con borde de al lado -- se leía como texto suelto,
                      // no como algo que se puede tocar. El tono
                      // destructivo + ícono lo deja claro sin necesitar
                      // más espacio.
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={handleRemoveImage}
                      >
                        <X /> Quitar foto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-name">Nombre</Label>
                <Input
                  id="product-name"
                  name="name"
                  defaultValue={editing?.name}
                  placeholder="Mole rojo"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-sku">
                  SKU / código de barras (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={skuInputRef}
                    id="product-sku"
                    name="sku"
                    defaultValue={editing?.sku ?? ''}
                    placeholder="MOL-001"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Escanear código de barras con la cámara"
                    onClick={() => setSkuScannerOpen(true)}
                  >
                    <ScanBarcode />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Si escaneas este código en Caja, el producto se agrega solo a
                  la venta.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-description">
                  Descripción (opcional)
                </Label>
                <Textarea
                  id="product-description"
                  name="description"
                  defaultValue={editing?.description ?? ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Categoría</Label>
                  <Select
                    items={[
                      { value: NO_CATEGORY, label: 'Sin categoría' },
                      ...activeCategories.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                    value={categoryId}
                    onValueChange={(value) =>
                      setCategoryId(value ?? NO_CATEGORY)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                      {activeCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Unidad</Label>
                  <Select
                    items={activeUnits.map((u) => ({
                      value: u.id,
                      label: `${u.code} — ${u.name}`,
                    }))}
                    value={unitId}
                    onValueChange={(value) => setUnitId(value ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Unidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code} — {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-price">
                    {soldByWeight ? 'Precio por kilo' : 'Precio de venta'}
                  </Label>
                  <Input
                    id="product-price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editing?.price ?? 0}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-cost">
                    Costo{soldByWeight ? ' por kilo' : ''}
                  </Label>
                  <Input
                    key={editing?.id ?? 'new'}
                    id="product-cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingCost}
                    required
                  />
                </div>
              </div>

              <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">
                    Vende a granel (por peso)
                  </p>
                  <p className="text-muted-foreground text-xs">
                    En Caja se cobra por gramos pedidos o por monto en pesos, no
                    por pieza. Requiere unidad kg.
                  </p>
                </div>
                <Switch
                  checked={soldByWeight}
                  onCheckedChange={setSoldByWeight}
                />
              </div>

              {soldByWeight && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-price-per-100g">
                    Precio de menudeo (100g)
                  </Label>
                  <Input
                    id="product-price-per-100g"
                    name="price_per_100g"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editing?.price_per_100g ?? 0}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Tarifa para cuando se pide menos de 1/4 kg. Se aplica el
                    precio por kilo desde 1/4 kg en adelante (incluye el
                    cuarto, que siempre sale a precio_kilo ÷ 4).
                  </p>
                </div>
              )}

              <div className="border-border flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Controlar inventario</p>
                  <p className="text-muted-foreground text-xs">
                    Descuenta existencias en cada venta y aparece en Inventario.
                  </p>
                </div>
                <Switch
                  checked={trackInventory}
                  onCheckedChange={setTrackInventory}
                />
              </div>

              {!editing && trackInventory && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-initial-stock">
                    Existencia inicial (opcional)
                    {unitId ? ` (${unitCode(unitId)})` : ''}
                  </Label>
                  <Input
                    id="product-initial-stock"
                    name="initial_stock"
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0"
                  />
                  <p className="text-muted-foreground text-xs">
                    Registra de una vez cuánto tienes hoy. Para corregirla más
                    adelante, usa "Ajustar existencia" en la lista.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="border-border shrink-0 border-t pt-4">
              <Button type="submit" disabled={!unitId || uploading}>
                {uploading
                  ? 'Subiendo imagen…'
                  : editing
                    ? 'Guardar cambios'
                    : 'Crear producto'}
              </Button>
            </DialogFooter>
          </form>
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
        open={skuScannerOpen}
        onOpenChange={setSkuScannerOpen}
        onDetected={(code) => {
          if (skuInputRef.current) skuInputRef.current.value = toCode(code)
        }}
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
