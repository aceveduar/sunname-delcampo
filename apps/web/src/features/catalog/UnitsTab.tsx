import { LoadError } from '@/components/LoadError'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUnits, type UnitOfMeasure } from './useUnits'

import { UnitForm } from './UnitForm'
import { useAsyncAction } from '@/lib/useAsyncAction'

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

  const toggle = useAsyncAction(
    'No se pudo cambiar el estado. Inténtalo de nuevo.',
  )

  const openCreate = () => {
    if (!canManage || toggle.pendingRef.current) return
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (unit: UnitOfMeasure) => {
    if (!canManage || toggle.pendingRef.current) return
    setEditing(unit)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Unidades en las que se venden y miden los productos (pieza, kilogramo,
          litro...).
        </p>
        {canManage && (
          <Button
            onClick={openCreate}
            size="sm"
            className="self-start"
            disabled={toggle.pending}
          >
            <Plus /> Nueva unidad
          </Button>
        )}
      </div>

      {toggle.error && (
        <p role="alert" className="text-destructive text-sm">
          {toggle.error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && !error && units.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canManage ? 4 : 3}
                className="text-muted-foreground text-center"
              >
                Aún no hay unidades de medida.
              </TableCell>
            </TableRow>
          )}
          {units.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell className="font-medium">{unit.code}</TableCell>
              <TableCell>{unit.name}</TableCell>
              <TableCell>
                <Badge variant={unit.active ? 'default' : 'secondary'}>
                  {unit.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.pending}
                    onClick={() => openEdit(unit)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.pending}
                    onClick={() => {
                      if (canManage) void toggle.run(() => toggleActive(unit))
                    }}
                  >
                    {unit.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canManage && dialogOpen && (
        <UnitForm
          unit={editing}
          onClose={() => setDialogOpen(false)}
          onSave={(values) =>
            canManage
              ? editing
                ? updateUnit(editing.id, values)
                : createUnit(values)
              : Promise.resolve(false)
          }
        />
      )}
    </div>
  )
}
