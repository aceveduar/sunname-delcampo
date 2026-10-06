import { Badge } from '@/components/ui/badge'
export function StockStatus({
  quantity,
  minimum,
}: {
  quantity: number
  minimum?: number
}) {
  const missing = quantity > 0 && minimum === undefined
  const low =
    quantity > 0 && minimum !== undefined && minimum > 0 && quantity <= minimum
  return (
    <Badge
      variant={quantity <= 0 ? 'destructive' : 'secondary'}
      className={
        low
          ? 'bg-brand-gold/15 text-foreground'
          : quantity > 0 && !missing
            ? 'bg-success/10 text-success'
            : undefined
      }
    >
      {quantity < 0
        ? 'Existencia negativa'
        : quantity === 0
          ? 'Agotado'
          : missing
            ? 'Mínimo sin verificar'
            : low
              ? 'Existencia baja'
              : 'Disponible'}
    </Badge>
  )
}
