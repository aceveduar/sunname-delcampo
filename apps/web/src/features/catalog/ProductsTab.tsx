import { useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaginationControls } from '@/components/PaginationControls'
import { formatCurrency } from '@/lib/currency'
import { toCode, toTitleCase } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'
import type { Database } from '@/lib/database.types'
import { useProducts, type Product } from './useProducts'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'

const NO_CATEGORY = 'none'

type Role = Database['public']['Enums']['user_role']
const CAN_MANAGE_PRODUCTS: Role[] = ['owner', 'local_admin']

export function ProductsTab({ role }: { role: Role | null }) {
  const { products, loading, createProduct, updateProduct, toggleActive, fetchCost } = useProducts()
  const { categories } = useCategories()
  const { units } = useUnits()

  const canManage = role !== null && CAN_MANAGE_PRODUCTS.includes(role)

  const [editing, setEditing] = useState<Product | null>(null)
  const [editingCost, setEditingCost] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY)
  const [unitId, setUnitId] = useState<string>('')
  const [trackInventory, setTrackInventory] = useState(true)
  const [search, setSearch] = useState('')

  const activeUnits = units.filter((u) => u.active)
  const activeCategories = categories.filter((c) => c.active)

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(query) || p.sku?.toLowerCase().includes(query),
    )
  }, [products, search])

  const { pageItems, page, setPage, totalPages, totalItems, pageSize } =
    usePagination(filteredProducts)

  const openCreate = () => {
    setEditing(null)
    setEditingCost(0)
    setCategoryId(NO_CATEGORY)
    setUnitId(activeUnits[0]?.id ?? '')
    setTrackInventory(true)
    setDialogOpen(true)
  }

  const openEdit = async (product: Product) => {
    const cost = await fetchCost(product.id)
    setEditing(product)
    setEditingCost(cost ?? 0)
    setCategoryId(product.category_id ?? NO_CATEGORY)
    setUnitId(product.unit_id)
    setTrackInventory(product.track_inventory)
    setDialogOpen(true)
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? '—'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!unitId) return

    const form = new FormData(event.currentTarget)
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
    }

    const ok = editing ? await updateProduct(editing.id, values) : await createProduct(values)
    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Productos que se venden en Del Campo, con su precio, categoría y unidad.
        </p>
        {canManage && (
          <Button onClick={openCreate} size="sm" disabled={activeUnits.length === 0}>
            <Plus /> Nuevo producto
          </Button>
        )}
      </div>

      {activeUnits.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Antes de dar de alta productos, crea al menos una unidad de medida en la pestaña
          "Unidades".
        </p>
      )}

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar producto por nombre o SKU…"
        className="max-w-sm"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && filteredProducts.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 7 : 6} className="text-muted-foreground text-center">
                {products.length === 0
                  ? 'Aún no hay productos en el catálogo.'
                  : `No se encontraron productos para "${search}".`}
              </TableCell>
            </TableRow>
          )}
          {pageItems.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.sku ?? '—'}</TableCell>
              <TableCell>{categoryName(product.category_id)}</TableCell>
              <TableCell>{unitCode(product.unit_id)}</TableCell>
              <TableCell>{formatCurrency(product.price)}</TableCell>
              <TableCell>
                <Badge variant={product.active ? 'default' : 'secondary'}>
                  {product.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(product)}>
                    {product.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
            <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
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
              <Label htmlFor="product-sku">SKU / código de barras (opcional)</Label>
              <Input id="product-sku" name="sku" defaultValue={editing?.sku ?? ''} placeholder="MOL-001" />
              <p className="text-muted-foreground text-xs">
                Si escaneas este código en Caja, el producto se agrega solo a la venta.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-description">Descripción (opcional)</Label>
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
                    ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  value={categoryId}
                  onValueChange={(value) => setCategoryId(value ?? NO_CATEGORY)}
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
                  items={activeUnits.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` }))}
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
                <Label htmlFor="product-price">Precio de venta</Label>
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
                <Label htmlFor="product-cost">Costo</Label>
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

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Controlar inventario</p>
                <p className="text-muted-foreground text-xs">
                  Descuenta existencias en cada venta y aparece en Inventario.
                </p>
              </div>
              <Switch checked={trackInventory} onCheckedChange={setTrackInventory} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!unitId}>
                {editing ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
