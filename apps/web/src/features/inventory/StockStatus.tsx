import { Badge } from '@/components/ui/badge'

export function StockStatus({
  quantity,
  minimum = 0,
}: {
  quantity: number
  minimum?: number
}) {
  return (
    <Badge variant={quantity <= 0 ? 'destructive' : 'secondary'}>
      {quantity < 0
        ? 'Existencia negativa'
        : quantity === 0
          ? 'Agotado'
          : minimum > 0 && quantity <= minimum
            ? 'Existencia baja'
            : 'Disponible'}
    </Badge>
  )
}
