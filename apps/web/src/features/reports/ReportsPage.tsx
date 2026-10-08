import { useState, type ReactNode } from 'react'
import { ChartNoAxesCombined, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { reportRange, localDateValue, type ReportPreset } from '@/lib/dateRange'
import { useSalesReport } from './useSalesReport'
import { ReportSummary } from './ReportSummary'
import { CashSessionReport } from './CashSessionReport'
import { DailySalesChart } from './DailySalesChart'
import { PaymentBreakdown } from './PaymentBreakdown'
import { TopProducts } from './TopProducts'
import { SalesHistory } from './SalesHistory'
import { reportDateTime } from './reportPresentation'

const PRESETS: { key: ReportPreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Últimos 7 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
]
export function ReportsPage({
  renderReceipt,
}: {
  renderReceipt: (saleId: string, onClose: () => void) => ReactNode
}) {
  const [preset, setPreset] = useState<ReportPreset>('today')
  const [startDate, setStartDate] = useState(() => localDateValue(new Date()))
  const [endDate, setEndDate] = useState(() => localDateValue(new Date()))
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [range, setRange] = useState(() => reportRange('today', new Date())!)
  const [historyKey, setHistoryKey] = useState(0)
  const [revision, setRevision] = useState(0)
  const [mutating, setMutating] = useState(false)
  const report = useSalesReport(range.from, range.to)
  const busy = report.loading || mutating
  const applyRange = (next: ReportPreset) => {
    setPreset(next)
    setRangeError(null)
    if (next === 'custom') return
    setRange(reportRange(next, new Date())!)
    setHistoryKey((key) => key + 1)
  }
  const updateRange = (resetHistory: boolean) => {
    const next = reportRange(preset, new Date(), startDate, endDate)
    if (!next) {
      setRangeError(
        'Indica fechas válidas; la fecha inicial no puede ser posterior a la final.',
      )
      return
    }
    setRangeError(null)
    if (next.from === range.from && next.to === range.to) void report.refresh()
    setRange(next)
    if (resetHistory) setHistoryKey((key) => key + 1)
    else setRevision((value) => value + 1)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ChartNoAxesCombined}
        title="Reportes"
        description="Entiende tus ventas, cobros y resultados del periodo."
        actions={
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => updateRange(false)}
          >
            <RefreshCw
              aria-hidden
              className={
                'size-4 ' +
                (report.loading
                  ? 'animate-spin motion-reduce:animate-none'
                  : '')
              }
            />
            {report.loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />
      <div className="bg-card space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((option) => (
            <Button
              key={option.key}
              variant={preset === option.key ? 'default' : 'outline'}
              size="sm"
              aria-pressed={preset === option.key}
              disabled={busy}
              onClick={() => applyRange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {preset === 'custom' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              updateRange(true)
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-0 flex-1 basis-40 space-y-1">
              <Label htmlFor="report-start">Desde</Label>
              <Input
                id="report-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                disabled={mutating}
              />
            </div>
            <div className="min-w-0 flex-1 basis-40 space-y-1">
              <Label htmlFor="report-end">Hasta</Label>
              <Input
                id="report-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                disabled={mutating}
              />
            </div>
            <Button disabled={busy} type="submit">
              Aplicar fechas
            </Button>
          </form>
        )}
        {rangeError && (
          <p role="alert" className="text-destructive text-sm">
            {rangeError}
          </p>
        )}
        <div
          className="text-muted-foreground space-y-1 text-xs"
          aria-live="polite"
        >
          <p>
            Periodo consultado: {reportDateTime(range.from)} —{' '}
            {reportDateTime(
              new Date(new Date(range.to).getTime() - 1).toISOString(),
            )}
          </p>
          <p>
            {report.loading
              ? 'Actualizando resumen…'
              : report.updatedAt
                ? 'Resumen actualizado a las ' +
                  report.updatedAt.toLocaleTimeString('es-MX')
                : 'Resumen pendiente de cargar.'}
          </p>
          {report.error && report.from && (
            <p>
              Se conserva el resumen del {reportDateTime(report.from)} al{' '}
              {reportDateTime(
                new Date(new Date(report.to).getTime() - 1).toISOString(),
              )}
              .
            </p>
          )}
        </div>
      </div>
      <LoadError
        message={report.error}
        onRetry={report.refresh}
        loading={report.loading}
      />
      <ReportSummary report={report} />
      {report.loading ? (
        <div
          className="grid gap-6 lg:grid-cols-2"
          aria-label="Cargando gráficos"
        >
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : report.updatedAt ? (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <DailySalesChart
                key={report.from + report.to}
                days={report.dailySales}
              />
              <PaymentBreakdown rows={report.byPaymentMethod} />
            </div>
            <TopProducts products={report.topProducts} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Cortes de caja del periodo</CardTitle>
              <p className="text-muted-foreground text-xs">
                Cajas cerradas en estas fechas. Cada corte incluye toda su
                sesión, aunque se haya abierto antes del periodo.
              </p>
            </CardHeader>
            <CardContent>
              {report.cashSessions.length ? (
                <CashSessionReport sessions={report.cashSessions} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No hay cortes de caja cerrados en este periodo.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Los gráficos estarán disponibles cuando se complete la consulta.
        </p>
      )}
      <SalesHistory
        key={historyKey}
        range={range}
        revision={revision}
        renderReceipt={renderReceipt}
        onVoided={report.refresh}
        onMutationChange={setMutating}
      />
    </div>
  )
}
