import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCategories, type ProductCategory } from './useCategories'

const NO_PARENT = 'none'

export function CategoriesTab() {
  const { categories, loading, createCategory, updateCategory, toggleActive } = useCategories()
  const [editing, setEditing] = useState<ProductCategory | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [parentId, setParentId] = useState<string>(NO_PARENT)

  const openCreate = () => {
    setEditing(null)
    setParentId(NO_PARENT)
    setDialogOpen(true)
  }

  const openEdit = (category: ProductCategory) => {
    setEditing(category)
    setParentId(category.parent_id ?? NO_PARENT)
    setDialogOpen(true)
  }

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const parent_id = parentId === NO_PARENT ? null : parentId

    const ok = editing
      ? await updateCategory(editing.id, { name, parent_id })
      : await createCategory({ name, parent_id })

    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Agrupa los productos del catálogo. Pueden anidarse (categoría dentro de categoría).
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus /> Nueva categoría
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría padre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && categories.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                Aún no hay categorías.
              </TableCell>
            </TableRow>
          )}
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>{categoryName(category.parent_id)}</TableCell>
              <TableCell>
                <Badge variant={category.active ? 'default' : 'secondary'}>
                  {category.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(category)}>
                  {category.active ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-name">Nombre</Label>
              <Input
                id="category-name"
                name="name"
                defaultValue={editing?.name}
                placeholder="Chiles secos"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoría padre (opcional)</Label>
              <Select
                items={[
                  { value: NO_PARENT, label: 'Sin categoría padre' },
                  ...categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={parentId}
                onValueChange={(value) => setParentId(value ?? NO_PARENT)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría padre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Sin categoría padre</SelectItem>
                  {categories
                    .filter((c) => c.id !== editing?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">{editing ? 'Guardar cambios' : 'Crear categoría'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
