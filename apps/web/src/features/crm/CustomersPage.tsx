import { useState, type FormEvent } from 'react'
import { Contact, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { toTitleCase } from '@/lib/text'
import { useCustomers, type Customer } from './useCustomers'

export function CustomersPage() {
  const { customers, loading, createCustomer, updateCustomer, toggleActive } = useCustomers()
  const [editing, setEditing] = useState<Customer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: toTitleCase(String(form.get('name') ?? '')),
      phone: String(form.get('phone') ?? '').trim() || null,
      email: String(form.get('email') ?? '').trim() || null,
      notes: String(form.get('notes') ?? '').trim() || null,
    }

    const ok = editing ? await updateCustomer(editing.id, values) : await createCustomer(values)
    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Tus clientes.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus /> Nuevo cliente
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableSkeletonRows rows={5} columns={5} />}
          {!loading && customers.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState
                  icon={Contact}
                  title="Aún no hay clientes"
                  description="Da de alta tu primer cliente para llevar su historial de compra."
                />
              </TableCell>
            </TableRow>
          )}
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>{customer.phone ?? '—'}</TableCell>
              <TableCell>{customer.email ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={customer.active ? 'default' : 'secondary'}>
                  {customer.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(customer)}>
                  {customer.active ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-name">Nombre</Label>
              <Input id="customer-name" name="name" defaultValue={editing?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-phone">Teléfono (opcional)</Label>
                <Input id="customer-phone" name="phone" defaultValue={editing?.phone ?? ''} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-email">Correo (opcional)</Label>
                <Input
                  id="customer-email"
                  name="email"
                  type="email"
                  defaultValue={editing?.email ?? ''}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-notes">Notas (opcional)</Label>
              <Textarea id="customer-notes" name="notes" defaultValue={editing?.notes ?? ''} />
            </div>
            <DialogFooter>
              <Button type="submit">{editing ? 'Guardar cambios' : 'Crear cliente'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
