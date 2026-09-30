import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/currency'
import type { useSalesReport } from './useSalesReport'

export function ReportSummary({
  report,
}: {
  report: ReturnType<typeof useSalesReport>
}) {
  const metrics = [
    {
      title: 'Total vendido',
      value: formatCurrency(report.totalAmount),
      help: 'Ventas completadas, sin anulaciones.',
    },
    {
      title: 'Tickets completados',
      value: String(report.saleCount),
      help: 'Ventas registradas en el periodo.',
    },
    {
      title: 'Ticket promedio',
      value: formatCurrency(report.avgTicket),
      help: 'Total vendido dividido entre tickets.',
    },
    {
      title: 'Utilidad bruta',
      value: formatCurrency(report.margin),
      help: `${report.marginPercent.toFixed(0)}% sobre ventas. Antes de gastos.`,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              {metric.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tabular-nums">
              {report.loading ? (
                <Skeleton className="h-8 w-24" />
              ) : report.updatedAt ? (
                metric.value
              ) : (
                '—'
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {report.updatedAt ? metric.help : 'Pendiente de cargar.'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
