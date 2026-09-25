import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'

export function MobileCartSummary({
  total,
  onOpen,
}: {
  total: number
  onOpen: () => void
}) {
  return (
    <div className="bg-card border-border fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">Total de la venta</p>
        <p className="text-lg font-semibold tabular-nums">
          {formatCurrency(total)}
        </p>
      </div>
      <Button onClick={onOpen} aria-controls="current-sale">
        Ver carrito
      </Button>
    </div>
  )
}
