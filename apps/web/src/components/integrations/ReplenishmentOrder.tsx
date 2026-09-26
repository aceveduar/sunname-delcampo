import { LoadError } from '@/components/LoadError'
import { useSuppliers } from '@/features/purchasing/useSuppliers'
import { useCreatePurchaseOrder } from '@/features/purchasing/useCreatePurchaseOrder'
import { NewPurchaseOrderDialog } from '@/features/purchasing/NewPurchaseOrderDialog'
import type { StockRow } from '@/features/inventory/useInventoryStock'
import { replenishmentQuantity } from '@/features/inventory/replenishment'

export function ReplenishmentOrder({
  rows,
  minimums,
  disabled,
}: {
  rows: StockRow[]
  minimums: Map<string, number>
  disabled: boolean
}) {
  const { suppliers, error, loading, refresh } = useSuppliers()
  const createOrder = useCreatePurchaseOrder()
  const initialLines = rows
    .map((row) => ({
      productId: row.product.id,
      quantity: replenishmentQuantity(
        row.quantityOnHand,
        minimums.get(row.product.id) ?? 0,
      ),
    }))
    .filter(
      (line) => line.quantity > 0 && (minimums.get(line.productId) ?? 0) > 0,
    )
  return (
    <div className="space-y-2">
      <LoadError message={error} loading={loading} onRetry={refresh} />
      <NewPurchaseOrderDialog
        suppliers={suppliers}
        products={rows.map((row) => row.product)}
        onCreate={createOrder}
        initialLines={initialLines}
        triggerLabel="Preparar compra"
        disabled={disabled || loading || !!error || initialLines.length === 0}
      />
    </div>
  )
}
