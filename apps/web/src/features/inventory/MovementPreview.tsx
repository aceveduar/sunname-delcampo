import { ArrowRight } from 'lucide-react'
import { formatStock } from './stockQuantity'

export function MovementPreview({
  current,
  projected,
  delta,
  unit,
}: {
  current: number
  projected: number | null
  delta: number | null
  unit: string
}) {
  return (
    <div
      className="bg-muted/50 space-y-2 rounded-xl border p-3"
      aria-label="Resumen del movimiento"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div>
          <p className="text-muted-foreground text-xs">Existencia actual</p>
          <p className="text-lg font-semibold wrap-break-word tabular-nums">
            {formatStock(current)} {unit}
          </p>
        </div>
        <ArrowRight className="text-muted-foreground size-4" aria-hidden />
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Resultado estimado</p>
          <p className="text-lg font-semibold wrap-break-word tabular-nums">
            {projected === null ? '—' : formatStock(projected) + ' ' + unit}
          </p>
        </div>
      </div>
      {delta !== null && (
        <p className="text-sm">
          {delta < 0 ? 'Se restarán ' : 'Se sumarán '}
          {formatStock(Math.abs(delta))} {unit}.
        </p>
      )}
      {projected !== null && projected < 0 && (
        <p className="text-destructive text-sm">
          El ajuste dejaría una existencia negativa. Revisa la cantidad.
        </p>
      )}
    </div>
  )
}
