import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { toast } from 'sonner'
import { ImageOff, LayoutGrid, Plus, TableIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
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
import { formatCurrency } from '@/lib/currency'
import { toCode, toTitleCase } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'
import type { Database } from '@/lib/database.types'
import { useProducts, type Product } from './useProducts'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'
import { LabelPrintDialog } from './LabelPrintDialog'

const NO_CATEGORY = 'none'

type Role = Database['public']['Enums']['user_role']
const CAN_MANAGE_PRODUCTS: Role[] = ['owner', 'local_admin']

export function ProductsTab({ role }: { role: Role | null }) {
  const {
    products,
    loading,
    createProduct,
    updateProduct,
    toggleActive,
    fetchCost,
  } = useProducts()
  const { categories } = useCategories()
  const { units } = useUnits()

  const canManage = role !== null && CAN_MANAGE_PRODUCTS.includes(role)

  const [editing, setEditing] = useState<Product | null>(null)
  const [editingCost, setEditingCost] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Se guarda el id, no el objeto: así, cuando se genera un código dentro
  // del diálogo, el refresh de useProducts trae el producto actualizado y
  // el diálogo lo ve sin quedarse con el snapshot viejo (sin SKU).
  const [labelProductId, setLabelProductId] = useState<string | null>(null)
  const labelProduct = products.find((p) => p.id === labelProductId) ?? null
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

  const activeUnits = units.filter((u) => u.active)
  const activeCategories = categories.filter((c) => c.active)

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((p) => {
      if (
        query &&
        !p.name.toLowerCase().includes(query) &&
        !p.sku?.toLowerCase().includes(query)
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
    setUnitId(activeUnits[0]?.id ?? '')
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
        toast.error('No se pudo subir la imagen', {
          description: uploadError.message,
        })
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

    const ok = editing
      ? await updateProduct(editing.id, values)
      : await createProduct(values)
    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Productos que vendes, con su precio, categoría y unidad.
        </p>
        {canManage && (
          <Button
            onClick={openCreate}
            size="sm"
            disabled={activeUnits.length === 0}
          >
            <Plus /> Nuevo producto
          </Button>
        )}
      </div>

      {activeUnits.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Antes de dar de alta productos, crea al menos una unidad de medida en
          la pestaña "Unidades".
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar producto por nombre o SKU…"
          className="max-w-sm"
        />
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
            aria-label="Vista de tarjetas"
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={[
            { value: 'all', label: 'Todas las categorías' },
            { value: NO_CATEGORY, label: 'Sin categoría' },
            ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={filterCategory}
          onValueChange={(value) => setFilterCategory(value ?? 'all')}
        >
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-40">
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
          {!loading && filteredProducts.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center text-sm">
              {products.length === 0
                ? 'Aún no hay productos en el catálogo.'
                : `No se encontraron productos para "${search}".`}
            </p>
          )}
          {pageItems.map((product) => (
            <div
              key={product.id}
              className="border-border bg-card flex flex-col overflow-hidden rounded-xl border"
            >
              <div className="bg-muted relative aspect-square w-full">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex size-full items-center justify-center">
                    <ImageOff className="size-8" />
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
                  <div className="border-border mt-2 flex flex-wrap gap-2 border-t pt-2">
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
            {!loading && filteredProducts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 8 : 7}
                  className="text-muted-foreground text-center"
                >
                  {products.length === 0
                    ? 'Aún no hay productos en el catálogo.'
                    : `No se encontraron productos para "${search}".`}
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
                  {product.sold_by_weight ? (
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
                    <div className="bg-muted text-muted-foreground border-border flex size-16 shrink-0 items-center justify-center rounded-md border">
                      <ImageOff className="size-5" />
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveImage}
                      >
                        Quitar foto
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
                <Input
                  id="product-sku"
                  name="sku"
                  defaultValue={editing?.sku ?? ''}
                  placeholder="MOL-001"
                />
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
                    Tarifa para cuando se pide menos de 1kg. Se aplica el precio
                    por kilo desde 1kg en adelante.
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
    </div>
  )
}
