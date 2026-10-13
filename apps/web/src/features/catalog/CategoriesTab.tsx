import { useCallback, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { useAsyncAction } from '@/lib/useAsyncAction'
import { useCategories, type ProductCategory } from './useCategories'
import { CategoryForm } from './CategoryForm'
import { CatalogReferenceDirectory } from './CatalogReferenceDirectory'
import { categoryPath } from './categoryHierarchy'

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
  const [pendingId, setPendingId] = useState<string | null>(null)
  const toggle = useAsyncAction(
    'No se pudo cambiar el estado. Inténtalo de nuevo.',
  )
  const disabled = loading || !!error || toggle.pending
  const detailValue = useCallback(
    (category: ProductCategory) => categoryPath(category.parent_id, categories),
    [categories],
  )

  const openForm = (category: ProductCategory | null) => {
    if (!canManage || loading || error || toggle.pendingRef.current) return
    setEditing(category)
    setDialogOpen(true)
  }
  const changeState = (category: ProductCategory) => {
    if (!canManage || loading || error || toggle.pendingRef.current) return
    void toggle.run(async () => {
      setPendingId(category.id)
      try {
        return await toggleActive(category)
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
          <h2 className="font-semibold">Organiza tus categorías</h2>
          <p className="text-muted-foreground text-sm">
            Agrupa productos y ubica cada categoría dentro de otra, si lo
            necesitas.
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
              Nueva categoría
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
        items={categories}
        singular="categoría"
        plural="categorías"
        detailLabel="Dentro de"
        detailValue={detailValue}
        searchPlaceholder="Buscar por nombre o categoría padre"
        loading={loading}
        error={error}
        canManage={canManage}
        pendingId={pendingId}
        onEdit={openForm}
        onToggle={changeState}
      />
      {canManage && dialogOpen && (
        <CategoryForm
          category={editing}
          categories={categories}
          onClose={() => setDialogOpen(false)}
          onSave={(values) =>
            !canManage || loading || error
              ? Promise.resolve(false)
              : editing
                ? updateCategory(editing.id, values)
                : createCategory(values)
          }
        />
      )}
    </div>
  )
}
