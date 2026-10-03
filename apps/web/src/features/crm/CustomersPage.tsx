import { PageHeader } from '@/components/PageHeader'
import { CustomerDirectory } from './CustomerDirectory'
import { LoadError } from '@/components/LoadError'
import { useState, type FormEvent } from 'react'
import { Contact, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { toTitleCase } from '@/lib/text'
import { useCustomers, type Customer } from './useCustomers'

export function CustomersPage() {
  const {
    customers,
    loading,
    error,
    refresh,
    createCustomer,
    updateCustomer,
    toggleActive,
  } = useCustomers()
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

    const ok = editing
      ? await updateCustomer(editing.id, values)
      : await createCustomer(values)
    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <PageHeader
        icon={Contact}
        title="Clientes"
        description="Personas que vuelven. Ten sus datos siempre a mano."
        actions={
          <Button onClick={openCreate}>
            <Plus /> Nuevo cliente
          </Button>
        }
      />
      <CustomerDirectory
        customers={customers}
        loading={loading}
        error={error}
        onEdit={openEdit}
        onToggle={toggleActive}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar cliente' : 'Nuevo cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-name">Nombre</Label>
              <Input
                id="customer-name"
                name="name"
                defaultValue={editing?.name}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-phone">Teléfono (opcional)</Label>
                <Input
                  id="customer-phone"
                  name="phone"
                  defaultValue={editing?.phone ?? ''}
                />
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
              <Textarea
                id="customer-notes"
                name="notes"
                defaultValue={editing?.notes ?? ''}
              />
            </div>
            <DialogFooter>
              <Button type="submit">
                {editing ? 'Guardar cambios' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
