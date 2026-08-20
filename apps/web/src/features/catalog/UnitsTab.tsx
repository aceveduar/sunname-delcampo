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
import { useUnits, type UnitOfMeasure } from './useUnits'

export function UnitsTab() {
  const { units, loading, createUnit, updateUnit, toggleActive } = useUnits()
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (unit: UnitOfMeasure) => {
    setEditing(unit)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code') ?? '').trim()
    const name = String(form.get('name') ?? '').trim()

    const ok = editing
      ? await updateUnit(editing.id, { code, name })
      : await createUnit({ code, name })

    if (ok) setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Unidades en las que se venden y miden los productos (pieza, kilogramo, litro...).
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus /> Nueva unidad
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && units.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
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
              <TableCell className="flex justify-end gap-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(unit)}>
                  Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(unit)}>
                  {unit.active ? 'Desactivar' : 'Activar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar unidad' : 'Nueva unidad'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-code">Código</Label>
              <Input id="unit-code" name="code" defaultValue={editing?.code} placeholder="KG" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit-name">Nombre</Label>
              <Input
                id="unit-name"
                name="name"
                defaultValue={editing?.name}
                placeholder="Kilogramo"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">{editing ? 'Guardar cambios' : 'Crear unidad'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
