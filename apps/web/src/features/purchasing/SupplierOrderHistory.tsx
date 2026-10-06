import { useCallback, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadError } from '@/components/LoadError'
import { EmptyState } from '@/components/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { formatCurrency } from '@/lib/currency'
import { PURCHASE_ORDER_SELECT, type PurchaseOrder } from './usePurchaseOrders'
import { orderStatus, ORDER_STATUS_LABELS } from './orderPresentation'
import { PurchaseOrderDetailDialog } from './PurchaseOrderDetailDialog'

const PAGE_SIZE = 10
export function SupplierOrderHistory({ supplierId }: { supplierId: string }) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const load = useCallback(async () => {
    const { data, count, error } = await supabase
      .from('purchase_orders')
      .select(PURCHASE_ORDER_SELECT, { count: 'exact' })
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    return {
      data: { rows: (data ?? []) as PurchaseOrder[], count: count ?? 0, page },
      error,
    }
  }, [supplierId, page])
  const history = useAsyncResource(
    load,
    'No se pudieron cargar las órdenes del proveedor',
    null,
  )
  return (
    <section className="space-y-4" aria-label="Órdenes del proveedor">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Órdenes de compra</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={history.loading}
          onClick={() => void history.refresh()}
        >
          Actualizar
        </Button>
      </div>
      <LoadError
        message={history.error}
        onRetry={history.refresh}
        loading={history.loading}
      />
      {history.loading ? (
        <p role="status" className="text-muted-foreground text-sm">
          Cargando órdenes…
        </p>
      ) : (
        !history.error &&
        history.data && (
          <>
            {!history.data.count ? (
              <EmptyState
                icon={ClipboardList}
                title="Todavía no hay órdenes"
                description="Las compras que registres con este proveedor aparecerán aquí."
              />
            ) : (
              <>
                <ul className="space-y-3">
                  {history.data.rows.map((order) => (
                    <li
                      key={order.id}
                      className="space-y-3 rounded-xl border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(order.created_at).toLocaleDateString(
                              'es-MX',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              },
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Orden {order.id.slice(0, 8)} ·{' '}
                            {order.purchase_order_items.length}{' '}
                            {order.purchase_order_items.length === 1
                              ? 'producto'
                              : 'productos'}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(
                            order.purchase_order_items.reduce(
                              (sum, item) => sum + item.subtotal,
                              0,
                            ),
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="secondary">
                          {ORDER_STATUS_LABELS[orderStatus(order)]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(order)}
                        >
                          Ver orden
                          <span className="sr-only">
                            {' '}
                            {order.id.slice(0, 8)}
                          </span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    {history.data.count} órdenes · Página{' '}
                    {history.data.page + 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={history.data.page === 0}
                      onClick={() => setPage(history.data!.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        (history.data.page + 1) * PAGE_SIZE >=
                        history.data.count
                      }
                      onClick={() => setPage(history.data!.page + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}
      <PurchaseOrderDetailDialog
        order={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </section>
  )
}
