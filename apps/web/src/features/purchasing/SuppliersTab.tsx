import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toTitleCase } from '@/lib/text'
import { useSuppliers, type Supplier } from './useSuppliers'

export function SuppliersTab() {
  const { suppliers, loading, createSupplier, updateSupplier, toggleActive } = useSuppliers()
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: toTitleCase(String(form.get('name') ?? '')),
      contact_name: toTitleCase(String(form.get('contact_name') ?? '')) || null,
      phone: String(form.get('phone') ?? '').trim() || null,
      email: String(form.get('email') ?? '').trim() || null,
    }

    const ok = editing
      ? await updateSupplier(editing.id, values)
      : await createSupplier(values)

    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Proveedores de Del Campo.</p>
        <Button onClick={openCreate} size="sm">
          <Plus /> Nuevo proveedor
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && suppliers.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                Aún no hay proveedores.
              </TableCell>
            </TableRow>
          )}
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.name}</TableCell>
              <TableCell>{supplier.contact_name ?? '—'}</TableCell>
              <TableCell>{supplier.phone ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={supplier.active ? 'default' : 'secondary'}>
                  {supplier.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(supplier)}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(supplier)}>
                  {supplier.active ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-name">Nombre</Label>
              <Input
                id="supplier-name"
                name="name"
                defaultValue={editing?.name}
                placeholder="Distribuidora del Bajío"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-contact">Contacto (opcional)</Label>
              <Input
                id="supplier-contact"
                name="contact_name"
                defaultValue={editing?.contact_name ?? ''}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier-phone">Teléfono (opcional)</Label>
                <Input id="supplier-phone" name="phone" defaultValue={editing?.phone ?? ''} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier-email">Correo (opcional)</Label>
                <Input
                  id="supplier-email"
                  name="email"
                  type="email"
                  defaultValue={editing?.email ?? ''}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">{editing ? 'Guardar cambios' : 'Crear proveedor'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
