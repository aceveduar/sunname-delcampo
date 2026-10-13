import { useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { LoadError } from '@/components/LoadError'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/usePagination'
import { useProducts } from '@/features/catalog/useProducts'
import { useUnits } from '@/features/catalog/useUnits'
import { PurchaseOrderCard } from './PurchaseOrderCard'
import { usePurchaseOrders, type PurchaseOrder } from './usePurchaseOrders'
import { useSuppliers } from './useSuppliers'
import { NewPurchaseOrderDialog } from './NewPurchaseOrderDialog'
import { TicketCaptureDialog } from './TicketCaptureDialog'
import { PurchaseOrderDetailDialog } from './PurchaseOrderDetailDialog'
import { PurchaseOrdersToolbar } from './PurchaseOrdersToolbar'
import {
  filterPurchaseOrders,
  purchaseFilter,
  purchaseStatusCounts,
  type PurchaseFilter,
} from './purchaseOrderFilters'

export function PurchaseOrdersTab({ userId }: { userId: string }) {
  const list = usePurchaseOrders()
  const suppliers = useSuppliers()
  const products = useProducts()
  const units = useUnits()
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null)
  const [params, setParams] = useSearchParams()
  const filter = purchaseFilter(params.get('purchaseStatus'))
  const query = params.get('supplierQuery') ?? ''
  const visible = useMemo(
    () => filterPurchaseOrders(list.orders, filter, query),
    [list.orders, filter, query],
  )
  const counts = useMemo(() => purchaseStatusCounts(list.orders), [list.orders])
  const pagination = usePagination(visible)
  const updateFilter = (key: string, value: string) => {
    pagination.resetPage()
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const clearFilters = () => {
    pagination.resetPage()
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('purchaseStatus')
        next.delete('supplierQuery')
        return next
      },
      { replace: true },
    )
  }
  const currentDetail = viewingOrder
    ? (list.orders.find((order) => order.id === viewingOrder.id) ??
      viewingOrder)
    : null
  const ready = !list.loading && !list.error
  const createReady =
    ready &&
    !suppliers.loading &&
    !suppliers.error &&
    !products.loading &&
    !products.error &&
    !units.loading &&
    !units.error
  const refreshAll = () =>
    void Promise.all([
      list.refresh(),
      suppliers.refresh(),
      products.refresh(),
      units.refresh(),
    ])
  const createOrder: typeof list.createOrder = async (values) => {
    if (!createReady) return false
    const ok = await list.createOrder(values)
    if (ok) clearFilters()
    return ok
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <LoadError
        message={list.error}
        onRetry={list.refresh}
        loading={list.loading}
      />
      <LoadError
        message={suppliers.error}
        onRetry={suppliers.refresh}
        loading={suppliers.loading}
      />
      <LoadError
        message={products.error}
        onRetry={products.refresh}
        loading={products.loading}
      />
      <LoadError
        message={units.error}
        onRetry={units.refresh}
        loading={units.loading}
      />
      <PurchaseOrdersToolbar
        filter={filter}
        counts={counts}
        query={query}
        settled={ready}
        refreshing={
          list.loading || suppliers.loading || products.loading || units.loading
        }
        onRefresh={refreshAll}
        onFilter={(value: PurchaseFilter) =>
          updateFilter('purchaseStatus', value === 'all' ? '' : value)
        }
        onQuery={(value) => updateFilter('supplierQuery', value)}
        onClear={clearFilters}
        actions={
          <>
            <TicketCaptureDialog
              disabled={!createReady}
              suppliers={suppliers.suppliers}
              products={products.products}
              units={units.units}
              onCreate={createOrder}
              onCreateSupplier={(values) =>
                createReady
                  ? suppliers.createSupplier(values)
                  : Promise.resolve(null)
              }
              onCreateProduct={(values) =>
                createReady
                  ? products.createProduct(values)
                  : Promise.resolve(null)
              }
            />
            <NewPurchaseOrderDialog
              disabled={!createReady}
              suppliers={suppliers.suppliers}
              products={products.products}
              onCreate={createOrder}
            />
          </>
        }
      />
      {list.error && list.orders.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Mostrando la última consulta correcta. Actualiza antes de recibir
          mercancía.
        </p>
      )}
      {list.loading && (
        <p role="status" className="text-muted-foreground text-sm">
          Actualizando órdenes…
        </p>
      )}
      {ready && visible.length > 0 && (
        <nav aria-label="Paginación superior de órdenes">
          <PaginationControls
            {...pagination}
            onPageChange={pagination.setPage}
          />
        </nav>
      )}
      {ready && visible.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={
            list.orders.length
              ? 'No hay órdenes con estos filtros'
              : 'Aún no hay órdenes de compra'
          }
          description={
            list.orders.length
              ? 'Prueba otro proveedor o limpia los filtros para ver todas.'
              : 'Crea una orden para registrar lo que esperas de un proveedor.'
          }
        />
      )}
      <div
        className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3"
        aria-label="Órdenes de compra"
        aria-busy={list.loading}
      >
        {list.loading &&
          !list.orders.length &&
          Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        {pagination.pageItems.map((order) => (
          <PurchaseOrderCard
            key={order.id}
            order={order}
            userId={userId}
            disabled={!ready}
            onView={() => setViewingOrder(order)}
            onSaved={list.refresh}
          />
        ))}
      </div>
      {ready && pagination.totalPages > 1 && (
        <nav aria-label="Paginación inferior de órdenes">
          <PaginationControls
            {...pagination}
            onPageChange={pagination.setPage}
          />
        </nav>
      )}
      <PurchaseOrderDetailDialog
        order={currentDetail}
        onOpenChange={(open) => {
          if (!open) setViewingOrder(null)
        }}
      />
    </div>
  )
}
