import { LoadError } from '@/components/LoadError'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { reportRange, localDateValue, type ReportPreset } from '@/lib/dateRange'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Total vendido
            </CardTitle>
          </CardHeader>
          <CardContent className="text-foreground text-2xl font-semibold">
            {report.loading ? (
              <Skeleton className="h-8 w-24" />
            ) : report.updatedAt ? (
              formatCurrency(report.totalAmount)
            ) : (
              '—'
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Utilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-2 text-2xl font-semibold">
            {report.loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                {report.updatedAt ? formatCurrency(report.margin) : '—'}
                <span className="text-muted-foreground text-sm font-normal">
                  {report.updatedAt ? report.marginPercent.toFixed(0) : '—'}%
                </span>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Ventas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {report.loading ? (
              <Skeleton className="h-8 w-12" />
            ) : report.updatedAt ? (
              report.saleCount
            ) : (
              '—'
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-normal">
              Ticket promedio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {report.loading ? (
              <Skeleton className="h-8 w-24" />
            ) : report.updatedAt ? (
              formatCurrency(report.avgTicket)
            ) : (
              '—'
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por método de pago</CardTitle>
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
                      <TableCell>{row.name}</TableCell>
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
                Sin ventas en este periodo.
              </p>
            ) : (
              <Table>
                <TableBody>
                  {report.topProducts.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas recientes</CardTitle>
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
                        {sale.status === 'voided' ? 'Anulada' : 'Completada'}
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
                            setVoidTarget({ id: sale.id, total: sale.total })
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cortes de caja del periodo</CardTitle>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cerrada</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Monto inicial</TableHead>
                  <TableHead>Ventas en efectivo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.cashSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{formatDateTime(session.closedAt)}</TableCell>
                    <TableCell>{session.openedBy}</TableCell>
                    <TableCell>
                      {formatCurrency(session.openingAmount)}
                    </TableCell>
                    <TableCell>{formatCurrency(session.cashSales)}</TableCell>
                    <TableCell>
                      {formatCurrency(session.expectedClosing)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(session.closingAmount)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        session.difference === 0
                          ? 'text-success'
                          : session.difference < 0
                            ? 'text-destructive'
                            : 'text-foreground'
                      }`}
                    >
                      {session.difference === 0
                        ? 'Cuadra'
                        : formatCurrency(session.difference)}
                      {session.notes && (
                        <p className="text-muted-foreground mt-1 max-w-64 text-left text-xs font-normal wrap-break-word whitespace-pre-wrap">
                          {session.notes}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
