import { LoadError } from '@/components/LoadError'
import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { useSearchParams } from 'react-router-dom'
import { SearchInput } from '@/components/ui/search-input'
import { normalizeSearch } from '@/lib/text'
import { PurchaseOrderCard } from './PurchaseOrderCard'
import { orderStatus } from './orderPresentation'
import { useProducts } from '@/features/catalog/useProducts'
import { useUnits } from '@/features/catalog/useUnits'
import { usePurchaseOrders, type PurchaseOrder } from './usePurchaseOrders'
import { useSuppliers } from './useSuppliers'
import { NewPurchaseOrderDialog } from './NewPurchaseOrderDialog'
import { TicketCaptureDialog } from './TicketCaptureDialog'
import { PurchaseOrderDetailDialog } from './PurchaseOrderDetailDialog'

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'ordered', label: 'Pendientes' },
  { key: 'partial', label: 'Parciales' },
  { key: 'received', label: 'Recibidas' },
  { key: 'draft', label: 'Borradores' },
  { key: 'cancelled', label: 'Canceladas' },
]

export function PurchaseOrdersTab({ userId }: { userId: string }) {
  const { orders, loading, error, refresh, createOrder } = usePurchaseOrders()
  const { suppliers, createSupplier } = useSuppliers()
  const { products, createProduct } = useProducts()
  const { units } = useUnits()
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null)

  const [params, setParams] = useSearchParams()
  const selectedFilter = params.get('purchaseStatus') ?? 'all'
  const filter = FILTERS.some((item) => item.key === selectedFilter)
    ? selectedFilter
    : 'all'
  const query = params.get('supplierQuery') ?? ''
  const setFilter = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const visible = orders.filter(
    (order) =>
      (filter === 'all' || orderStatus(order) === filter) &&
      normalizeSearch((order.supplier?.name ?? '') + ' ' + order.id).includes(
        normalizeSearch(query),
      ),
  )
  const clearFilters = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('purchaseStatus')
        next.delete('supplierQuery')
        return next
      },
      { replace: true },
    )
  const currentDetail = viewingOrder
    ? (orders.find((order) => order.id === viewingOrder.id) ?? viewingOrder)
    : null
  return (
    <div className="flex flex-col gap-4">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Órdenes de compra a proveedores. Al recibir una, se registra la
          entrada en Inventario.
        </p>
        <div className="flex flex-wrap gap-2">
          <TicketCaptureDialog
            suppliers={suppliers}
            products={products}
            units={units}
            onCreate={createOrder}
            onCreateSupplier={createSupplier}
            onCreateProduct={createProduct}
          />
          <NewPurchaseOrderDialog
            suppliers={suppliers}
            products={products}
            onCreate={createOrder}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SearchInput
          value={query}
          onChange={(value) => setFilter('supplierQuery', value)}
          placeholder="Buscar proveedor o folio"
        />
        <div
          aria-label="Filtrar órdenes por estado"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={filter === item.key ? 'default' : 'outline'}
              aria-pressed={filter === item.key}
              onClick={() =>
                setFilter('purchaseStatus', item.key === 'all' ? '' : item.key)
              }
            >
              {item.label} (
              {
                orders.filter(
                  (order) =>
                    item.key === 'all' || orderStatus(order) === item.key,
                ).length
              }
              )
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-muted-foreground">
            {loading
              ? 'Actualizando órdenes…'
              : visible.length + ' órdenes visibles'}
          </p>
          {(query || filter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={
            orders.length
              ? 'No hay órdenes con estos filtros'
              : 'Aún no hay órdenes de compra'
          }
          description={
            orders.length
              ? 'Prueba otro proveedor o limpia los filtros para ver todas.'
              : 'Crea una orden para registrar lo que esperas de un proveedor.'
          }
        />
      )}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((order) => (
          <PurchaseOrderCard
            key={order.id}
            order={order}
            userId={userId}
            onView={() => setViewingOrder(order)}
            onSaved={refresh}
          />
        ))}
      </div>

      <PurchaseOrderDetailDialog
        order={currentDetail}
        onOpenChange={(open) => {
          if (!open) setViewingOrder(null)
        }}
      />
    </div>
  )
}
