import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Package, ScanBarcode, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { compressImage } from '@/lib/image'
import { withUploadTimeout } from '@/lib/upload'
import { toCode, toTitleCase } from '@/lib/text'
import { useRegisterMovement } from '@/features/inventory/useRegisterMovement'
import type { Product, useProducts } from './useProducts'
import { NO_CATEGORY, type ProductCategory } from './useCategories'
import type { UnitOfMeasure } from './useUnits'

/** Alta/edición de un producto -- diálogo completo, incluye subir foto,
 * escanear el SKU con la cámara, y (solo al dar de alta) registrar
 * existencia inicial. `product` null = crear; con producto = editar. */
export function ProductForm({
  product,
  open,
  onOpenChange,
  categories,
  units,
  defaultUnitId,
  createProduct,
  updateProduct,
  fetchCost,
}: {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: ProductCategory[]
  units: UnitOfMeasure[]
  defaultUnitId: string
  createProduct: ReturnType<typeof useProducts>['createProduct']
  updateProduct: ReturnType<typeof useProducts>['updateProduct']
  fetchCost: ReturnType<typeof useProducts>['fetchCost']
}) {
  const registerInitialStock = useRegisterMovement(() => {})

  const [editingCost, setEditingCost] = useState('0')
  const [loadingCost, setLoadingCost] = useState(false)
  const [skuScannerOpen, setSkuScannerOpen] = useState(false)
  const skuInputRef = useRef<HTMLInputElement>(null)
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [unitId, setUnitId] = useState<string>('')
  const [trackInventory, setTrackInventory] = useState(true)
  const [soldByWeight, setSoldByWeight] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [uploading, setUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const activeUnits = units.filter((u) => u.active)
  const activeCategories = categories.filter((c) => c.active)

  // Se dispara al abrir -- crear parte de blanco (con la unidad default),
  // editar carga los valores reales del producto, incluido su costo
  // (aparte porque products_select no lo trae para todos los roles, hay
  // que pedirlo explícito).
  useEffect(() => {
    if (!open) return
    setCategoryId(product?.category_id ?? NO_CATEGORY)
    setUnitId(product?.unit_id ?? defaultUnitId)
    setTrackInventory(product?.track_inventory ?? true)
    setSoldByWeight(product?.sold_by_weight ?? false)
    setImageFile(null)
    setImagePreview(product?.image_url ?? null)
    setRemoveImage(false)
    setEditingCost('0')
    if (product) {
      // Campo controlado (no defaultValue): con un `key` fijo por
      // producto, el diálogo abre antes de que esta promesa resuelva y un
      // valor inicial "de una sola vez" nunca llegaba al DOM ya montado --
      // se veía como si editar siempre reseteara el costo a 0. Deshabilitado
      // mientras carga para que tampoco se pueda escribir encima del "0" de
      // arranque y perder el valor real cuando la promesa resuelva.
      setLoadingCost(true)
      fetchCost(product.id).then((cost) => {
        setEditingCost(String(cost ?? 0))
        setLoadingCost(false)
      })
    }
  }, [product, open, defaultUnitId, fetchCost])

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

  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? '—'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!unitId) return

    // event.currentTarget deja de ser válido en cuanto el handler cruza un
    // await (el navegador lo limpia al terminar el despacho síncrono del
    // evento) -- hay que capturarlo antes de subir la imagen.
    const formEl = event.currentTarget

    let imageUrl = removeImage ? null : (product?.image_url ?? null)

    if (imageFile) {
      setUploading(true)
      const compressed = await compressImage(imageFile)
      const ext = compressed.name.split('.').pop() ?? 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await withUploadTimeout(
        supabase.storage.from('product-images').upload(path, compressed),
      )
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

    if (product) {
      const ok = await updateProduct(product.id, values)
      if (ok) onOpenChange(false)
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
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {product ? 'Editar producto' : 'Nuevo producto'}
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
                  defaultValue={product?.name}
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
                    defaultValue={product?.sku ?? ''}
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
                  defaultValue={product?.description ?? ''}
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
                    defaultValue={product?.price ?? 0}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-cost">
                    Costo{soldByWeight ? ' por kilo' : ''}
                  </Label>
                  <Input
                    id="product-cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingCost}
                    onChange={(event) => setEditingCost(event.target.value)}
                    disabled={loadingCost}
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
                    defaultValue={product?.price_per_100g ?? 0}
                    required
                  />
                  <p className="text-muted-foreground text-xs">
                    Tarifa para cuando se pide menos de 1/4 kg. Se aplica el
                    precio por kilo desde 1/4 kg en adelante (incluye el cuarto,
                    que siempre sale a precio_kilo ÷ 4).
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

              {!product && trackInventory && (
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
                  : product
                    ? 'Guardar cambios'
                    : 'Crear producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BarcodeScannerDialog
        open={skuScannerOpen}
        onOpenChange={setSkuScannerOpen}
        onDetected={(code) => {
          if (skuInputRef.current) skuInputRef.current.value = toCode(code)
        }}
      />
    </>
  )
}
