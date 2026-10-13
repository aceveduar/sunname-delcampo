import { useMemo, useState } from 'react'
import { LoadError } from '@/components/LoadError'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaginationControls } from '@/components/PaginationControls'
import { BarcodeScannerDialog } from '@/components/BarcodeScannerDialog'
import { useAsyncAction } from '@/lib/useAsyncAction'
import type { Database } from '@/lib/database.types'
import { useProducts, type Product } from './useProducts'
import { useProductCosts } from './useProductCosts'
import { useCategories } from './useCategories'
import { useUnits } from './useUnits'
import { useProductFilters } from './useProductFilters'
import { ProductForm } from './ProductForm'
import { LabelPrintDialog } from './LabelPrintDialog'
import { PriceSheetDialog } from './PriceSheetDialog'
import { StockAdjustDialog } from './StockAdjustDialog'
import { PriceEditor } from './PriceEditor'
import { ProductActions } from './ProductActions'
import { ProductDirectory, type ProductView } from './ProductDirectory'
import { ProductsToolbar } from './ProductsToolbar'

type Role = Database['public']['Enums']['user_role']

export function ProductsTab({ role }: { role: Role | null }) {
  const canManage = role === 'owner' || role === 'local_admin'
  const canDelete = role === 'owner'
  const {
    products,
    loading,
    error,
    refresh,
    createProduct,
    updateProduct,
    updatePrices,
    toggleActive,
    deleteProduct,
    fetchCost,
  } = useProducts()
  const categories = useCategories()
  const units = useUnits()
  const costs = useProductCosts(canManage)
  const filters = useProductFilters(products, categories.categories)
  const [view, setView] = useState<ProductView>('table')
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [labelProductId, setLabelProductId] = useState<string | null>(null)
  const [stockAdjustProductId, setStockAdjustProductId] = useState<
    string | null
  >(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [searchScannerOpen, setSearchScannerOpen] = useState(false)
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)
  const [priceEditMode, setPriceEditMode] = useState(false)
  const [pending, setPending] = useState<{ id: string; label: string } | null>(
    null,
  )
  const rowAction = useAsyncAction(
    'No se pudo completar la acción. Revisa el estado del producto y vuelve a intentarlo.',
  )
  const referencesLoading = categories.loading || units.loading
  const ready =
    !loading &&
    !error &&
    !referencesLoading &&
    !categories.error &&
    !units.error
  const disabled = !ready || rowAction.pending

  const categoryNames = useMemo(
    () =>
      new Map(
        categories.categories.map((category) => [
          category.id,
          `${category.name}${category.active ? '' : ' (inactiva)'}`,
        ]),
      ),
    [categories.categories],
  )
  const unitCodes = useMemo(
    () => new Map(units.units.map((unit) => [unit.id, unit.code])),
    [units.units],
  )
  const categoryName = (id: string | null) =>
    id ? (categoryNames.get(id) ?? 'Categoría no disponible') : 'Sin categoría'
  const unitCode = (id: string) => unitCodes.get(id) ?? 'Unidad no disponible'
  const activeUnits = units.units.filter((unit) => unit.active)
  const defaultUnitId =
    activeUnits.find((unit) => unit.code === 'PZA')?.id ??
    activeUnits[0]?.id ??
    ''
  const labelProduct =
    products.find((product) => product.id === labelProductId) ?? null
  const stockProduct =
    products.find((product) => product.id === stockAdjustProductId) ?? null

  const allowAction = () => canManage && ready && !rowAction.pendingRef.current
  const openForm = (product: Product | null) => {
    if (!allowAction() || (!product && !activeUnits.length)) return
    setEditingProduct(product)
    setProductFormOpen(true)
  }
  const runRow = (
    product: Product,
    label: string,
    action: () => Promise<boolean>,
  ) => {
    if (!allowAction()) return
    void rowAction.run(async () => {
      setPending({ id: product.id, label })
      try {
        return await action()
      } finally {
        setPending(null)
      }
    })
  }
  const refreshAll = async () => {
    if (rowAction.pendingRef.current) return
    await Promise.all([
      refresh(),
      categories.refresh(),
      units.refresh(),
      costs.refresh(),
    ])
  }
  const saveProduct: typeof updateProduct = async (id, values) => {
    if (!allowAction()) return false
    const ok = await updateProduct(id, values)
    if (ok) await costs.refresh()
    return ok
  }
  const addProduct: typeof createProduct = async (values) => {
    if (!allowAction()) return null
    const id = await createProduct(values)
    if (id) await costs.refresh()
    return id
  }
  const savePrices: typeof updatePrices = async (changes) =>
    allowAction() ? updatePrices(changes) : false

  const loadErrors = (
    <>
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <LoadError
        message={categories.error}
        onRetry={categories.refresh}
        loading={categories.loading}
      />
      <LoadError
        message={units.error}
        onRetry={units.refresh}
        loading={units.loading}
      />
    </>
  )
  if (priceEditMode && canManage)
    return (
      <div className="space-y-4">
        {loadErrors}
        <PriceEditor
          products={products}
          onSave={savePrices}
          onClose={() => setPriceEditMode(false)}
          unitCode={unitCode}
          unavailable={!ready}
        />
      </div>
    )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {loadErrors}
      <LoadError
        message={costs.error}
        onRetry={costs.refresh}
        loading={costs.loading}
      />
      <ProductsToolbar
        filters={filters}
        view={view}
        onView={setView}
        canManage={canManage}
        disabled={disabled}
        noUnits={!activeUnits.length}
        refreshing={
          loading || referencesLoading || costs.loading || rowAction.pending
        }
        onRefresh={() => void refreshAll()}
        onCreate={() => openForm(null)}
        onEditPrices={() => {
          if (allowAction()) setPriceEditMode(true)
        }}
        onPriceSheet={() => {
          if (allowAction()) setPriceSheetOpen(true)
        }}
        onScan={() => setSearchScannerOpen(true)}
      />
      {canManage && !units.loading && !units.error && !activeUnits.length && (
        <p className="text-muted-foreground text-sm">
          Para crear productos, activa o crea una unidad de medida en la pestaña
          Unidades.
        </p>
      )}
      {(error || categories.error || units.error) && products.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Mostrando la última consulta correcta. Actualiza para editar
          productos.
        </p>
      )}
      {rowAction.error && !deleteTarget && (
        <p role="alert" className="text-destructive text-sm">
          {rowAction.error}
        </p>
      )}
      {!loading && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          {filters.totalItems}{' '}
          {filters.totalItems === 1 ? 'producto' : 'productos'}
          {filters.filtersActive || filters.search.trim()
            ? ' con estos filtros'
            : ' en el catálogo'}
        </p>
      )}
      {loading && products.length > 0 && (
        <p role="status" className="text-muted-foreground text-sm">
          Actualizando productos…
        </p>
      )}
      {!loading && !error && filters.totalPages > 1 && (
        <nav aria-label="Paginación superior de productos">
          <PaginationControls {...filters} onPageChange={filters.setPage} />
        </nav>
      )}
      <ProductDirectory
        products={filters.pageItems}
        view={view}
        loading={loading}
        error={error}
        hasFilters={filters.filtersActive || !!filters.search.trim()}
        categoryName={categoryName}
        unitCode={unitCode}
        costsById={costs.costsById}
        actions={
          canManage
            ? (product) => (
                <ProductActions
                  product={product}
                  canDelete={canDelete}
                  disabled={disabled}
                  pendingLabel={
                    pending?.id === product.id ? pending.label : undefined
                  }
                  onEdit={() => openForm(product)}
                  onToggle={() =>
                    runRow(
                      product,
                      product.active ? 'Desactivando…' : 'Activando…',
                      () => toggleActive(product),
                    )
                  }
                  onLabel={() => {
                    if (allowAction()) setLabelProductId(product.id)
                  }}
                  onStock={() => {
                    if (allowAction()) setStockAdjustProductId(product.id)
                  }}
                  onDelete={() => {
                    if (allowAction() && canDelete) {
                      rowAction.clearError()
                      setDeleteTarget(product)
                    }
                  }}
                />
              )
            : undefined
        }
      />
      {!loading && !error && filters.totalItems > 0 && (
        <nav aria-label="Paginación inferior de productos">
          <PaginationControls {...filters} onPageChange={filters.setPage} />
        </nav>
      )}
      {canManage && (
        <>
          <ProductForm
            product={editingProduct}
            open={productFormOpen}
            onOpenChange={setProductFormOpen}
            categories={categories.categories}
            units={units.units}
            defaultUnitId={defaultUnitId}
            createProduct={addProduct}
            updateProduct={saveProduct}
            fetchCost={fetchCost}
          />
          <PriceSheetDialog
            open={priceSheetOpen}
            onOpenChange={setPriceSheetOpen}
            products={products}
            units={activeUnits}
            onApply={savePrices}
            onCreateProduct={addProduct}
          />
          <LabelPrintDialog
            product={labelProduct}
            onOpenChange={(open) => {
              if (!open) setLabelProductId(null)
            }}
            onAssignSku={(id, sku) => saveProduct(id, { sku })}
          />
          <StockAdjustDialog
            product={stockProduct}
            unitLabel={stockProduct ? unitCode(stockProduct.unit_id) : ''}
            onOpenChange={(open) => {
              if (!open) setStockAdjustProductId(null)
            }}
            onDone={() => {}}
          />
        </>
      )}
      <BarcodeScannerDialog
        open={searchScannerOpen}
        onOpenChange={setSearchScannerOpen}
        onDetected={filters.setSearch}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !rowAction.pendingRef.current) setDeleteTarget(null)
        }}
        title="Borrar producto"
        confirmLabel="Borrar"
        confirmingLabel="Borrando…"
        variant="destructive"
        confirming={rowAction.pending}
        description={
          <div className="space-y-3">
            <p className="text-foreground wrap-anywhere">
              Se va a borrar <strong>{deleteTarget?.name}</strong> del catálogo.
              No se puede deshacer.
            </p>
            <p>
              Solo se puede borrar un producto sin ventas, inventario ni
              compras. Si ya tiene historial, desactívalo.
            </p>
            {rowAction.error && (
              <p role="alert" className="text-destructive">
                {rowAction.error}
              </p>
            )}
          </div>
        }
        onConfirm={() => {
          if (!deleteTarget || !canDelete) return
          const target = deleteTarget
          runRow(target, 'Borrando…', async () => {
            const ok = await deleteProduct(target.id)
            if (ok) setDeleteTarget(null)
            return ok
          })
        }}
      />
    </div>
  )
}
