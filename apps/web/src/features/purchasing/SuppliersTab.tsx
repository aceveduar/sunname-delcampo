import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadError } from '@/components/LoadError'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { reportError } from '@/lib/errors'
import { useSuppliers, type Supplier } from './useSuppliers'
import { SupplierDirectory } from './SupplierDirectory'
import { SupplierForm } from './SupplierForm'
import { SupplierPanel } from './SupplierPanel'
import { SupplierOrderHistory } from './SupplierOrderHistory'

export function SuppliersTab() {
  const {
    suppliers,
    loading,
    error,
    refresh,
    createSupplier,
    updateSupplier,
    toggleActive,
  } = useSuppliers()
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toggle, setToggle] = useState<Supplier | null>(null)
  const [toggling, setToggling] = useState(false)
  const toggleBusy = useRef(false)
  const selected = suppliers.find((supplier) => supplier.id === selectedId)
  const edit = (supplier: Supplier) => {
    setEditing(supplier)
    setFormOpen(true)
  }
  const form = formOpen && (
    <SupplierForm
      key={editing?.id ?? 'new'}
      supplier={editing}
      onClose={() => setFormOpen(false)}
      onSave={async (values) =>
        editing
          ? updateSupplier(editing.id, values)
          : !!(await createSupplier(values))
      }
    />
  )
  const confirmToggle = async () => {
    if (!toggle || toggleBusy.current) return
    toggleBusy.current = true
    setToggling(true)
    try {
      if (await toggleActive(toggle)) setToggle(null)
    } catch (cause) {
      reportError('No se pudo cambiar el estado del proveedor', cause)
    } finally {
      toggleBusy.current = false
      setToggling(false)
    }
  }
  return (
    <div className="space-y-4">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Contactos y órdenes, en una misma ficha.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus />
          Nuevo proveedor
        </Button>
      </div>
      <SupplierDirectory
        suppliers={suppliers}
        loading={loading}
        error={error}
        onEdit={edit}
        onToggle={setToggle}
        onView={(supplier) => setSelectedId(supplier.id)}
      />
      {selected ? (
        <SupplierPanel
          supplier={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => edit(selected)}
        >
          <SupplierOrderHistory
            key={'orders-' + selected.id}
            supplierId={selected.id}
          />
          {form}
        </SupplierPanel>
      ) : (
        form
      )}
      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(open) => {
          if (!open && !toggleBusy.current) setToggle(null)
        }}
        title={
          toggle?.active ? '¿Desactivar proveedor?' : '¿Activar proveedor?'
        }
        description={
          toggle?.active
            ? 'Conservarás su historial. Dejará de aparecer al crear nuevas órdenes.'
            : 'Volverá a estar disponible para nuevas órdenes de compra.'
        }
        confirmLabel={toggle?.active ? 'Desactivar' : 'Activar'}
        confirming={toggling}
        onConfirm={() => void confirmToggle()}
      />
    </div>
  )
}
