import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import { useProducts } from '@/features/catalog/useProducts'
import { usePurchaseOrders } from './usePurchaseOrders'
import { useSuppliers } from './useSuppliers'
import { NewPurchaseOrderDialog } from './NewPurchaseOrderDialog'

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
  const { suppliers } = useSuppliers()
  const { products } = useProducts()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Órdenes de compra a proveedores. Al recibir una, se registra la entrada en Inventario.
        </p>
        <NewPurchaseOrderDialog suppliers={suppliers} products={products} onCreate={createOrder} />
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
          {!loading && orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                Aún no hay órdenes de compra.
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
