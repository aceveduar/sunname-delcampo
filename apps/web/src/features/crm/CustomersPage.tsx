import { useState, type ReactNode } from 'react'
import { Contact, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { CustomerDirectory } from './CustomerDirectory'
import { CustomerForm, type CustomerValues } from './CustomerForm'
import { CustomerPanel } from './CustomerPanel'
import { useCustomers, type Customer } from './useCustomers'

export function CustomersPage({
  renderHistory,
}: {
  renderHistory?: (customerId: string) => ReactNode
}) {
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
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = customers.find((customer) => customer.id === selectedId)
  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setFormOpen(true)
  }
  const save = async (values: CustomerValues) =>
    editing
      ? updateCustomer(editing.id, values)
      : !!(await createCustomer(values))
  return (
    <div className="flex flex-col gap-6">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <PageHeader
        icon={Contact}
        title="Clientes"
        description="Personas que vuelven. Ten sus datos siempre a mano."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus />
            Nuevo cliente
          </Button>
        }
      />
      <CustomerDirectory
        customers={customers}
        loading={loading}
        error={error}
        onEdit={openEdit}
        onToggle={toggleActive}
        onView={(customer) => setSelectedId(customer.id)}
      />
      {selected && (
        <CustomerPanel
          customer={selected}
          onClose={() => {
            if (!formOpen) setSelectedId(null)
          }}
          onEdit={() => openEdit(selected)}
        >
          {renderHistory?.(selected.id)}
        </CustomerPanel>
      )}
      {formOpen && (
        <CustomerForm
          customer={editing}
          onSave={save}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}
