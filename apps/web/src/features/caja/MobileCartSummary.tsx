import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'

export function MobileCartSummary({
  total,
  onOpen,
  canCheckout,
  submitting,
  onCheckout,
}: {
  total: number
  onOpen: () => void
  canCheckout: boolean
  submitting: boolean
  onCheckout: () => void
}) {
  return (
    <div className="bg-card border-border fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">Total de la venta</p>
        <p className="text-lg font-semibold tabular-nums">
          {formatCurrency(total)}
        </p>
        <button
          type="button"
          onClick={onOpen}
          aria-controls="current-sale"
          className="text-primary min-h-9 text-sm underline underline-offset-4"
        >
          Ver carrito
        </button>
      </div>
      <Button
        className="min-h-12 shrink-0"
        disabled={submitting}
        onClick={canCheckout ? onCheckout : onOpen}
        aria-controls="current-sale"
      >
        {submitting ? 'Cobrando…' : canCheckout ? 'Cobrar' : 'Revisar pago'}
      </Button>
    </div>
  )
}
