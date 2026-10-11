import { useState } from 'react'
import { SaveDialog } from '@/components/SaveDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toTitleCase } from '@/lib/text'

export function UserNameForm({
  initialName,
  onSave,
  onClose,
}: {
  initialName: string
  onSave: (name: string) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  return (
    <SaveDialog
      title="Editar nombre"
      dirty={name !== initialName}
      onClose={onClose}
      onSave={() =>
        name.trim() ? onSave(toTitleCase(name.trim())) : Promise.resolve(false)
      }
    >
      {() => (
        <div className="space-y-1.5">
          <Label htmlFor="edit-full-name">Nombre completo</Label>
          <Input
            id="edit-full-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
      )}
    </SaveDialog>
  )
}
