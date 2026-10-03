import {
  Banknote,
  ReceiptText,
  ChartNoAxesCombined,
  Wallet,
} from 'lucide-react'
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
      icon: Banknote,
      value: formatCurrency(report.totalAmount),
      help: 'Ventas completadas, sin anulaciones.',
    },
    {
      title: 'Tickets completados',
      icon: ReceiptText,
      value: String(report.saleCount),
      help: 'Ventas registradas en el periodo.',
    },
    {
      title: 'Ticket promedio',
      icon: Wallet,
      value: formatCurrency(report.avgTicket),
      help: 'Total vendido dividido entre tickets.',
    },
    {
      title: 'Utilidad bruta',
      icon: ChartNoAxesCombined,
      value: formatCurrency(report.margin),
      help: `${report.marginPercent.toFixed(0)}% sobre ventas. Antes de gastos.`,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <Card
          key={metric.title}
          className={
            index === 0
              ? 'bg-sidebar text-sidebar-foreground border-sidebar-border shadow-sm'
              : 'shadow-sm'
          }
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle
              className={
                index === 0
                  ? 'text-sidebar-foreground/80 text-sm font-medium'
                  : 'text-muted-foreground text-sm font-medium'
              }
            >
              {metric.title}
            </CardTitle>
            <metric.icon
              aria-hidden
              className={
                index === 0
                  ? 'text-sidebar-primary size-5 shrink-0'
                  : 'text-primary size-5 shrink-0'
              }
            />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold tracking-tight break-words tabular-nums">
              {report.loading ? (
                <Skeleton className="h-8 w-24" />
              ) : report.updatedAt ? (
                metric.value
              ) : (
                '—'
              )}
            </div>
            <p
              className={
                index === 0
                  ? 'text-sidebar-foreground/70 text-xs'
                  : 'text-muted-foreground text-xs'
              }
            >
              {report.updatedAt ? metric.help : 'Pendiente de cargar.'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
