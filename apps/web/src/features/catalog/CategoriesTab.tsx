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
import { useCategories, type ProductCategory } from './useCategories'

import { CategoryForm } from './CategoryForm'
import { useAsyncAction } from '@/lib/useAsyncAction'

export function CategoriesTab({ canManage = false }: { canManage?: boolean }) {
  const {
    categories,
    loading,
    error,
    refresh,
    createCategory,
    updateCategory,
    toggleActive,
  } = useCategories()
  const [editing, setEditing] = useState<ProductCategory | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const toggle = useAsyncAction(
    'No se pudo cambiar el estado. Inténtalo de nuevo.',
  )

  const openCreate = () => {
    if (!canManage || toggle.pendingRef.current) return
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (category: ProductCategory) => {
    if (!canManage || toggle.pendingRef.current) return
    setEditing(category)
    setDialogOpen(true)
  }

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col gap-4">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Agrupa los productos del catálogo. Pueden anidarse (categoría dentro
          de categoría).
        </p>
        {canManage && (
          <Button
            onClick={openCreate}
            size="sm"
            className="self-start"
            disabled={toggle.pending}
          >
            <Plus /> Nueva categoría
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
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría padre</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && !error && categories.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canManage ? 4 : 3}
                className="text-muted-foreground text-center"
              >
                Aún no hay categorías.
              </TableCell>
            </TableRow>
          )}
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell>{categoryName(category.parent_id)}</TableCell>
              <TableCell>
                <Badge variant={category.active ? 'default' : 'secondary'}>
                  {category.active ? 'Activa' : 'Inactiva'}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.pending}
                    onClick={() => openEdit(category)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggle.pending}
                    onClick={() => {
                      if (canManage)
                        void toggle.run(() => toggleActive(category))
                    }}
                  >
                    {category.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canManage && dialogOpen && (
        <CategoryForm
          category={editing}
          categories={categories}
          onClose={() => setDialogOpen(false)}
          onSave={(values) =>
            canManage
              ? editing
                ? updateCategory(editing.id, values)
                : createCategory(values)
              : Promise.resolve(false)
          }
        />
      )}
    </div>
  )
}
