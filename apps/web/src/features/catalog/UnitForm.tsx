import { useState } from 'react'
import { SaveDialog } from '@/components/SaveDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toCode, toTitleCase } from '@/lib/text'
import type { UnitOfMeasure } from './useUnits'

export function UnitForm({
  unit,
  onSave,
  onClose,
}: {
  unit: UnitOfMeasure | null
  onSave: (values: { code: string; name: string }) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(unit?.name ?? '')
  const [code, setCode] = useState(unit?.code ?? '')
  return (
    <SaveDialog
      title={unit ? 'Editar unidad' : 'Nueva unidad'}
      description="Define cómo se venden y miden los productos."
      saveLabel={unit ? 'Guardar cambios' : 'Crear unidad'}
      onClose={onClose}
      dirty={name !== (unit?.name ?? '') || code !== (unit?.code ?? '')}
      onSave={() =>
        name.trim() && code.trim()
          ? onSave({
              code: toCode(code.trim()),
              name: toTitleCase(name.trim()),
            })
          : Promise.resolve(false)
      }
    >
      {() => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="unit-code">Código</Label>
            <Input
              id="unit-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="KG"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit-name">Nombre</Label>
            <Input
              id="unit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Kilogramo"
            />
          </div>
        </>
      )}
    </SaveDialog>
  )
}
