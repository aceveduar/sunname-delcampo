import { CashSessionReport } from './CashSessionReport'
import { ReportSummary } from './ReportSummary'
import { LoadError } from '@/components/LoadError'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reportRange, localDateValue, type ReportPreset } from '@/lib/dateRange'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/currency'
import { useSalesReport } from './useSalesReport'
import { useSales } from './useSales'

const PRESETS: { key: ReportPreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Últimos 7 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
]

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ReportsPage({
  renderReceipt,
}: {
  renderReceipt: (saleId: string, onClose: () => void) => ReactNode
}) {
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [preset, setPreset] = useState<ReportPreset>('today')
  const [startDate, setStartDate] = useState(() => localDateValue(new Date()))
  const [endDate, setEndDate] = useState(() => localDateValue(new Date()))
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [range, setRange] = useState(() => reportRange('today', new Date())!)
  const { from, to } = range
  const report = useSalesReport(from, to)
  const {
    sales,
    loading: salesLoading,
    error: salesError,
    refresh: refreshSales,
    updatedAt: salesUpdatedAt,
    loadedFrom: salesFrom,
    loadedTo: salesTo,
    voidSale,
  } = useSales(from, to)
  const busy = report.loading || salesLoading
  const applyRange = (next: ReportPreset) => {
    setPreset(next)
    if (next === 'custom') return
    setRangeError(null)
    setRange(reportRange(next, new Date())!)
  }
  const updateRange = () => {
    const next = reportRange(preset, new Date(), startDate, endDate)
    if (!next) {
      setRangeError(
        'Indica fechas válidas; la fecha inicial no puede ser posterior a la final.',
      )
      return
    }
    setRangeError(null)
    if (next.from === from && next.to === to) {
      void report.refresh()
      void refreshSales()
    } else setRange(next)
  }
  const lastUpdated =
    report.updatedAt && salesUpdatedAt
      ? new Date(Math.min(report.updatedAt.getTime(), salesUpdatedAt.getTime()))
      : null
  const [voidTarget, setVoidTarget] = useState<{
    id: string
    total: number
  } | null>(null)
  const [voiding, setVoiding] = useState(false)

  const handleVoid = async () => {
    if (!voidTarget) return
    setVoiding(true)
    const ok = await voidSale(voidTarget.id)
    setVoiding(false)
    if (ok) {
      setVoidTarget(null)
      await report.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Reportes</h1>
          <p className="text-muted-foreground text-sm">
            Ventas e historial de caja del periodo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={preset === p.key ? 'default' : 'outline'}
              size="sm"
              aria-pressed={preset === p.key}
              disabled={busy}
              onClick={() => applyRange(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            updateRange()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-1">
            <Label htmlFor="report-start">Desde</Label>
            <Input
              id="report-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-end">Hasta</Label>
            <Input
              id="report-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-sm" aria-live="polite">
          <p>
            Periodo consultado: {formatDateTime(from)} —{' '}
            {formatDateTime(new Date(new Date(to).getTime() - 1).toISOString())}
          </p>
          <p>
            {busy
              ? 'Actualizando…'
              : lastUpdated
                ? 'Última actualización: ' +
                  lastUpdated.toLocaleTimeString('es-MX')
                : 'Sin una carga completa todavía'}
          </p>
          {(report.error || salesError) && report.from && (
            <p>
              Resumen conservado: {formatDateTime(report.from)} —{' '}
              {formatDateTime(
                new Date(new Date(report.to).getTime() - 1).toISOString(),
              )}
              .
            </p>
          )}
        </div>
        <Button variant="outline" disabled={busy} onClick={updateRange}>
          Actualizar
        </Button>
      </div>
      <LoadError
        message={report.error}
        onRetry={report.refresh}
        loading={report.loading}
      />
      <LoadError
        message={salesError}
        onRetry={refreshSales}
        loading={salesLoading}
      />

      <ReportSummary report={report} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cobros de ventas por método</CardTitle>
            <p className="text-muted-foreground text-xs">
              Solo ventas completadas. No incluye entradas ni salidas manuales
              de caja.
            </p>
          </CardHeader>
          <CardContent>
            {report.byPaymentMethod.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {report.loading
                  ? 'Cargando…'
                  : report.error
                    ? 'Datos no disponibles.'
                    : 'Sin ventas en este periodo.'}
              </p>
            ) : (
              <Table>
                <TableBody>
                  {report.byPaymentMethod.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="wrap-break-word whitespace-normal">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {report.loading
                  ? 'Cargando…'
                  : report.error
                    ? 'Datos no disponibles.'
                    : 'Sin ventas en este periodo.'}
              </p>
            ) : (
              <ul className="divide-y">
                {report.topProducts.map((row) => (
                  <li
                    key={row.name}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span className="min-w-0 basis-full font-medium wrap-break-word sm:flex-1 sm:basis-auto">
                      {row.name}
                    </span>
                    <span className="text-muted-foreground">
                      Cantidad: {row.quantity}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cortes de caja del periodo</CardTitle>
          <p className="text-muted-foreground text-xs">
            Cajas cerradas en estas fechas. Cada corte incluye toda su sesión,
            aunque se haya abierto antes del periodo.
          </p>
        </CardHeader>
        <CardContent>
          {report.cashSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {report.loading
                ? 'Cargando…'
                : report.error
                  ? 'Datos no disponibles.'
                  : 'No hay cortes de caja cerrados en este periodo.'}
            </p>
          ) : (
            <CashSessionReport sessions={report.cashSessions} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ventas recientes</CardTitle>
          <p className="text-muted-foreground text-xs">
            Hasta 50 ventas del periodo, incluidas las anuladas.
          </p>
          {salesFrom && (
            <p className="text-muted-foreground text-xs">
              Datos de {formatDateTime(salesFrom)} a{' '}
              {formatDateTime(
                new Date(new Date(salesTo).getTime() - 1).toISOString(),
              )}
              .
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!salesLoading && !salesError && sales.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin ventas en este periodo.
            </p>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {salesLoading && <p role="status">Cargando ventas…</p>}
                {sales.map((sale) => (
                  <article
                    key={sale.id}
                    className="space-y-2 rounded-xl border p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-lg font-semibold tabular-nums">
                        {formatCurrency(sale.total)}
                      </span>
                      <Badge
                        variant={
                          sale.status === 'voided' ? 'secondary' : 'default'
                        }
                      >
                        {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(sale.createdAt)}
                    </p>
                    <p className="text-sm wrap-break-word">{sale.soldBy}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReceiptId(sale.id)}
                      >
                        Ver ticket
                      </Button>
                      {sale.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setVoidTarget({ id: sale.id, total: sale.total })
                          }
                        >
                          Anular
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cajero</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesLoading && <TableSkeletonRows rows={4} columns={5} />}
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                        <TableCell>{sale.soldBy}</TableCell>
                        <TableCell>{formatCurrency(sale.total)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              sale.status === 'voided' ? 'secondary' : 'default'
                            }
                          >
                            {sale.status === 'voided'
                              ? 'Anulada'
                              : 'Completada'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReceiptId(sale.id)}
                          >
                            Ver ticket
                          </Button>
                          {sale.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setVoidTarget({
                                  id: sale.id,
                                  total: sale.total,
                                })
                              }
                            >
                              Anular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {receiptId && renderReceipt(receiptId, () => setReceiptId(null))}
      <ConfirmDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVoidTarget(null)
        }}
        title="Anular venta"
        description={
          voidTarget &&
          `¿Anular esta venta de ${formatCurrency(voidTarget.total)}? Repone el inventario vendido.`
        }
        confirmLabel="Anular"
        confirmingLabel="Anulando…"
        variant="destructive"
        confirming={voiding}
        onConfirm={handleVoid}
      />
    </div>
  )
}
