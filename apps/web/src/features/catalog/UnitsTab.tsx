import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { useAsyncAction } from '@/lib/useAsyncAction'
import { useUnits, type UnitOfMeasure } from './useUnits'
import { UnitForm } from './UnitForm'
import { CatalogReferenceDirectory } from './CatalogReferenceDirectory'

const unitCode = (unit: UnitOfMeasure) => unit.code

export function UnitsTab({ canManage = false }: { canManage?: boolean }) {
  const {
    units,
    loading,
    error,
    refresh,
    createUnit,
    updateUnit,
    toggleActive,
  } = useUnits()
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const toggle = useAsyncAction(
    'No se pudo cambiar el estado. Inténtalo de nuevo.',
  )
  const disabled = loading || !!error || toggle.pending

  const openForm = (unit: UnitOfMeasure | null) => {
    if (!canManage || loading || error || toggle.pendingRef.current) return
    setEditing(unit)
    setDialogOpen(true)
  }
  const changeState = (unit: UnitOfMeasure) => {
    if (!canManage || loading || error || toggle.pendingRef.current) return
    void toggle.run(async () => {
      setPendingId(unit.id)
      try {
        return await toggleActive(unit)
      } finally {
        setPendingId(null)
      }
    })
  }
  return (
    <div className="flex flex-col gap-4">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <h2 className="font-semibold">Unidades de venta y medida</h2>
          <p className="text-muted-foreground text-sm">
            Identifica cada medida por su nombre y código: pieza, kilogramo,
            litro…
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || toggle.pending}
            onClick={() => void refresh()}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          {canManage && (
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => openForm(null)}
            >
              <Plus />
              Nueva unidad
            </Button>
          )}
        </div>
      </div>
      {toggle.error && (
        <p role="alert" className="text-destructive text-sm">
          {toggle.error}
        </p>
      )}
      <CatalogReferenceDirectory
        items={units}
        singular="unidad"
        plural="unidades"
        detailLabel="Código"
        detailValue={unitCode}
        searchPlaceholder="Buscar por nombre o código"
        loading={loading}
        error={error}
        canManage={canManage}
        pendingId={pendingId}
        onEdit={openForm}
        onToggle={changeState}
      />
      {canManage && dialogOpen && (
        <UnitForm
          unit={editing}
          onClose={() => setDialogOpen(false)}
          onSave={(values) =>
            !canManage || loading || error
              ? Promise.resolve(false)
              : editing
                ? updateUnit(editing.id, values)
                : createUnit(values)
          }
        />
      )}
    </div>
  )
}
