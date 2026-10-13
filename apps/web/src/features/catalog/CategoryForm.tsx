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
import { categoryParentOptions, categoryPath } from './categoryHierarchy'

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
  const parentOptions = categoryParentOptions(categories, category?.id)
  const validParent =
    parentId === 'none' ||
    parentOptions.some((option) => option.value === parentId)
  const options = [
    { value: 'none', label: 'Categoría principal (sin padre)' },
    ...parentOptions,
    ...(!validParent
      ? [
          {
            value: parentId,
            label: `${categoryPath(parentId, categories)} · Revisa esta relación`,
          },
        ]
      : []),
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
        name.trim() && validParent
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
              <SelectTrigger
                id="category-parent"
                className="min-h-8 w-full min-w-0 whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none"
              >
                <SelectValue className="min-w-0 [overflow-wrap:anywhere]" />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    disabled={!validParent && item.value === parentId}
                    className="[&>:first-child]:min-w-0 [&>:first-child]:shrink [&>:first-child]:wrap-anywhere [&>:first-child]:whitespace-normal"
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Déjala como principal o elige dónde agruparla. No puede depender
              de sí misma ni de una de sus subcategorías.
            </p>
            {!validParent && (
              <p role="alert" className="text-destructive text-sm">
                La categoría padre actual no está disponible o forma un ciclo.
                Elige otra relación antes de guardar.
              </p>
            )}
          </div>
        </>
      )}
    </SaveDialog>
  )
}
