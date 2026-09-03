import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { formatCurrency } from '@/lib/currency'
import { useProducts } from '@/features/catalog/useProducts'
import { useUnits } from '@/features/catalog/useUnits'
import { usePurchaseOrders } from './usePurchaseOrders'
import { useSuppliers } from './useSuppliers'
import { NewPurchaseOrderDialog } from './NewPurchaseOrderDialog'
import { TicketCaptureDialog } from './TicketCaptureDialog'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ordered: 'Pendiente',
  received: 'Recibida',
  cancelled: 'Cancelada',
}

function orderTotal(order: { purchase_order_items: { subtotal: number }[] }) {
  return order.purchase_order_items.reduce((sum, item) => sum + item.subtotal, 0)
}

export function PurchaseOrdersTab() {
  const { orders, loading, createOrder, receiveOrder } = usePurchaseOrders()
  const { suppliers, createSupplier } = useSuppliers()
  const { products, createProduct } = useProducts()
  const { units } = useUnits()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Órdenes de compra a proveedores. Al recibir una, se registra la entrada en Inventario.
        </p>
        <div className="flex shrink-0 gap-2">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableSkeletonRows rows={5} columns={5} />}
          {!loading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState
                  icon={ClipboardList}
                  title="Aún no hay órdenes de compra"
                  description="Crea una orden para registrar la mercancía que esperas de un proveedor."
                />
              </TableCell>
            </TableRow>
          )}
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.supplier?.name ?? '—'}</TableCell>
              <TableCell>
                {new Date(order.created_at).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell>{formatCurrency(orderTotal(order))}</TableCell>
              <TableCell>
                <Badge variant={order.status === 'received' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {order.status === 'ordered' && (
                  <Button variant="ghost" size="sm" onClick={() => receiveOrder(order.id)}>
                    Recibir
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
