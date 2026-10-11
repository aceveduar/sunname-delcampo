import { useState } from 'react'
import { SaveDialog } from '@/components/SaveDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toTitleCase } from '@/lib/text'
import type { ProductCategory } from './useCategories'

export function CategoryForm({
  category,
  categories,
  onSave,
  onClose,
}: {
  category: ProductCategory | null
  categories: ProductCategory[]
  onSave: (values: {
    name: string
    parent_id: string | null
  }) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState(category?.parent_id ?? 'none')
  const options = [
    { value: 'none', label: 'Sin categoría padre' },
    ...categories
      .filter((item) => item.id !== category?.id)
      .map((item) => ({ value: item.id, label: item.name })),
  ]
  return (
    <SaveDialog
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      description="Agrupa productos para encontrarlos más fácilmente."
      saveLabel={category ? 'Guardar cambios' : 'Crear categoría'}
      onClose={onClose}
      dirty={
        name !== (category?.name ?? '') ||
        parentId !== (category?.parent_id ?? 'none')
      }
      onSave={() =>
        name.trim()
          ? onSave({
              name: toTitleCase(name.trim()),
              parent_id: parentId === 'none' ? null : parentId,
            })
          : Promise.resolve(false)
      }
    >
      {(saving) => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Chiles secos"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-parent">Categoría padre (opcional)</Label>
            <Select
              items={options}
              value={parentId}
              disabled={saving}
              onValueChange={(value) => setParentId(value ?? 'none')}
            >
              <SelectTrigger id="category-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </SaveDialog>
  )
}
