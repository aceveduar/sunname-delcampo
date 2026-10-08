import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LoadError } from '@/components/LoadError'
import { formatCurrency } from '@/lib/currency'
import { uuidPrefixRange } from '@/lib/uuidPrefix'
import { reportDateTime } from './reportPresentation'
import {
  useSales,
  SALES_PAGE_SIZE,
  type SaleRow,
  type SalesQuery,
} from './useSales'
import type { ReportRange } from './reportTypes'

const statuses: { value: SalesQuery['status']; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'voided', label: 'Anuladas' },
]
function SaleActions({
  sale,
  disabled,
  onReceipt,
  onVoid,
}: {
  sale: SaleRow
  disabled: boolean
  onReceipt: (id: string) => void
  onVoid: (sale: SaleRow) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      <Button variant="outline" size="sm" onClick={() => onReceipt(sale.id)}>
        Ver ticket
      </Button>
      {sale.status === 'completed' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onVoid(sale)}
        >
          Anular
        </Button>
      )}
    </div>
  )
}
export function SalesHistory({
  range,
  revision,
  renderReceipt,
  onVoided,
  onMutationChange,
}: {
  range: ReportRange
  revision: number
  renderReceipt: (saleId: string, onClose: () => void) => ReactNode
  onVoided: () => Promise<void>
  onMutationChange: (busy: boolean) => void
}) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<SalesQuery['status']>('all')
  const [folio, setFolio] = useState('')
  const [appliedFolio, setAppliedFolio] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<SaleRow | null>(null)
  const [voiding, setVoiding] = useState(false)
  const mutation = useRef(false)
  const query = useMemo(
    () => ({ ...range, page, status, folio: appliedFolio, revision }),
    [range, page, status, appliedFolio, revision],
  )
  const history = useSales(query)
  const busy = history.loading || voiding
  const disabled = busy || !history.current || !!history.error
  const totalPages = Math.max(1, Math.ceil(history.count / SALES_PAGE_SIZE))
  const clear = () => {
    setStatus('all')
    setFolio('')
    setAppliedFolio('')
    setPage(1)
    setFilterError(null)
  }
  const confirmVoid = async () => {
    if (!voidTarget || mutation.current) return
    mutation.current = true
    setVoiding(true)
    onMutationChange(true)
    try {
      if (await history.voidSale(voidTarget.id)) {
        setVoidTarget(null)
        await onVoided()
      }
    } finally {
      mutation.current = false
      setVoiding(false)
      onMutationChange(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de ventas</CardTitle>
        <p className="text-muted-foreground text-xs">
          Consulta todos los tickets del periodo, incluidas las ventas anuladas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          <legend className="sr-only">Filtros del historial</legend>
          <div className="flex flex-wrap items-center gap-2">
            {statuses.map((option) => (
              <Button
                key={option.value}
                variant={status === option.value ? 'default' : 'outline'}
                size="sm"
                aria-pressed={status === option.value}
                onClick={() => {
                  setStatus(option.value)
                  setPage(1)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <form
            className="flex flex-wrap items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              try {
                uuidPrefixRange(folio)
                setAppliedFolio(folio.trim())
                setPage(1)
                setFilterError(null)
              } catch (cause) {
                setFilterError(
                  cause instanceof Error ? cause.message : 'Verifica el folio.',
                )
              }
            }}
          >
            <div className="min-w-0 flex-1 basis-48 space-y-1">
              <Input
                aria-label="Buscar por folio"
                placeholder="Folio corto o completo"
                value={folio}
                aria-describedby="report-folio-help"
                aria-invalid={!!filterError}
                onChange={(event) => setFolio(event.target.value)}
              />
              <p
                id="report-folio-help"
                className="text-muted-foreground text-xs"
              >
                Desde 4 caracteres del folio impreso.
              </p>
            </div>
            <Button type="submit" variant="outline">
              Buscar folio
            </Button>
            {(appliedFolio || status !== 'all') && (
              <Button type="button" variant="ghost" onClick={clear}>
                Limpiar filtros
              </Button>
            )}
          </form>
        </fieldset>
        {filterError && (
          <p role="alert" className="text-destructive text-sm">
            {filterError}
          </p>
        )}
        {appliedFolio && (
          <p className="text-muted-foreground text-xs">
            Folio aplicado: {appliedFolio}
          </p>
        )}
        <LoadError
          message={history.error}
          loading={history.loading}
          onRetry={history.refresh}
        />
        {history.query && (
          <p className="text-muted-foreground text-xs">
            {!history.current &&
              !history.loading &&
              'Se conserva la última consulta correcta. '}
            Datos del {reportDateTime(history.query.from)} al{' '}
            {reportDateTime(
              new Date(new Date(history.query.to).getTime() - 1).toISOString(),
            )}
            . Estado:{' '}
            {
              statuses.find((option) => option.value === history.query?.status)
                ?.label
            }
            .{history.query.folio && ' Folio: ' + history.query.folio + '.'}
          </p>
        )}
        <div aria-busy={history.loading}>
          {history.loading && (
            <p role="status" className="text-muted-foreground mb-3 text-sm">
              Actualizando historial…
            </p>
          )}
          {!history.loading && !history.error && !history.sales.length && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {appliedFolio || status !== 'all'
                ? 'No hay ventas con estos filtros.'
                : 'Sin ventas en este periodo.'}
            </p>
          )}
          <div className="space-y-3 md:hidden">
            {history.sales.map((sale) => (
              <article
                key={sale.id}
                className="space-y-3 rounded-xl border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(sale.total)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Folio {sale.id.slice(0, 8)}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {reportDateTime(sale.createdAt)}
                </p>
                <p className="text-sm wrap-break-word">{sale.soldBy}</p>
                <SaleActions
                  sale={sale}
                  disabled={disabled}
                  onReceipt={setReceiptId}
                  onVoid={setVoidTarget}
                />
              </article>
            ))}
          </div>
          {(history.sales.length > 0 || history.loading) && (
            <div className="hidden md:block">
              <Table className="w-full min-w-[40rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha / folio</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.loading && !history.sales.length && (
                    <TableSkeletonRows rows={5} columns={5} />
                  )}
                  {history.sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <p>{reportDateTime(sale.createdAt)}</p>
                        <p className="text-muted-foreground text-xs">
                          Folio {sale.id.slice(0, 8)}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-56 wrap-break-word whitespace-normal">
                        {sale.soldBy}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SaleActions
                          sale={sale}
                          disabled={disabled}
                          onReceipt={setReceiptId}
                          onVoid={setVoidTarget}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        {history.count > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {(history.page - 1) * SALES_PAGE_SIZE + 1}–
              {Math.min(history.page * SALES_PAGE_SIZE, history.count)} de{' '}
              {history.count} {history.count === 1 ? 'venta' : 'ventas'}
              {totalPages > 1 &&
                ' · Página ' + history.page + ' de ' + totalPages}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || history.page <= 1}
                  onClick={() => setPage(history.page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || history.page >= totalPages}
                  onClick={() => setPage(history.page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
      {receiptId && renderReceipt(receiptId, () => setReceiptId(null))}
      <ConfirmDialog
        open={!!voidTarget}
        onOpenChange={(open) => {
          if (!open && !mutation.current) setVoidTarget(null)
        }}
        title="Anular venta"
        description={
          voidTarget
            ? '¿Anular el folio ' +
              voidTarget.id.slice(0, 8) +
              ' por ' +
              formatCurrency(voidTarget.total) +
              '? Repone el inventario vendido.'
            : ''
        }
        confirmLabel="Anular venta"
        confirmingLabel="Anulando…"
        variant="destructive"
        confirming={voiding}
        onConfirm={confirmVoid}
      />
    </Card>
  )
}
