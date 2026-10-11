import { ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { PaginationControls } from '@/components/PaginationControls'
import { formatCurrency } from '@/lib/currency'
import {
  BILLING_PAGE_SIZE,
  BILLING_STATUSES,
  billingDate,
  type BillableSession,
  type BillingResult,
} from './billingData'
import { BillingStatus } from './BillingStatus'

export function BillingSessions({
  data,
  loading,
  error,
  current,
  onPage,
  onOpen,
}: {
  data: BillingResult | null
  loading: boolean
  error: string | null
  current: boolean
  onPage: (page: number) => void
  onOpen: (id: string) => void
}) {
  const busy = loading || !!error || !current
  const rows = data?.rows ?? []
  const cash = (row: BillableSession) =>
    row.cashCounted === null ? 'No registrado' : formatCurrency(row.cashCounted)
  const amount = (row: BillableSession) => (
    <div className="space-y-0.5">
      <p className="font-semibold tabular-nums">
        {formatCurrency(row.invoice?.total ?? row.salesTotal)}
      </p>
      <p className="text-muted-foreground text-xs">
        {row.invoice ? 'Total de la solicitud' : 'Ventas del corte'}
      </p>
    </div>
  )
  const action = (row: BillableSession) => (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => onOpen(row.cashSessionId)}
    >
      {row.invoice ? 'Ver detalle' : 'Revisar corte'}
      <span className="sr-only"> {row.cashSessionId.slice(0, 8)}</span>
    </Button>
  )
  return (
    <section className="space-y-4" aria-label="Cortes para facturación">
      {data && (
        <div className="text-muted-foreground space-y-1 text-sm" role="status">
          <p>
            {data.query.values.start
              ? `Cierres del ${data.query.values.start} al ${data.query.values.end}`
              : 'Todo el historial de cierres'}{' '}
            ·{' '}
            {
              BILLING_STATUSES.find(
                (item) => item.value === data.query.values.status,
              )?.label
            }
          </p>
          <p>
            {busy
              ? 'Mostrando la última consulta correcta.'
              : `${data.count} ${data.count === 1 ? 'corte encontrado' : 'cortes encontrados'}.`}
          </p>
        </div>
      )}
      {!busy && !rows.length ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={ReceiptText}
            title="Sin cortes con estos filtros"
            description="Prueba otro periodo o estado. Los cortes aparecen aquí después de cerrar la caja."
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block" aria-label="Tabla de cortes">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corte cerrado</TableHead>
                  <TableHead>Cerrado por</TableHead>
                  <TableHead>Efectivo contado</TableHead>
                  <TableHead>Importe de facturación</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data && <TableSkeletonRows rows={5} columns={6} />}
                {rows.map((row) => (
                  <TableRow key={row.cashSessionId}>
                    <TableCell>
                      <p>{billingDate(row.closedAt)}</p>
                      <p className="text-muted-foreground text-xs">
                        Corte {row.cashSessionId.slice(0, 8)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-40 wrap-anywhere whitespace-normal">
                      {row.closedBy}
                    </TableCell>
                    <TableCell className="tabular-nums">{cash(row)}</TableCell>
                    <TableCell>{amount(row)}</TableCell>
                    <TableCell>
                      <BillingStatus invoice={row.invoice} />
                    </TableCell>
                    <TableCell className="text-right">{action(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 lg:hidden" aria-label="Tarjetas de cortes">
            {loading && !data && <p role="status">Cargando cortes…</p>}
            {rows.map((row) => (
              <article
                key={row.cashSessionId}
                className="bg-card space-y-4 rounded-xl border p-4 shadow-sm"
                aria-label={`Corte ${row.cashSessionId.slice(0, 8)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {billingDate(row.closedAt)}
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      Corte {row.cashSessionId.slice(0, 8)}
                    </p>
                  </div>
                  <BillingStatus invoice={row.invoice} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs">
                      Efectivo contado
                    </p>
                    <p className="text-sm tabular-nums">{cash(row)}</p>
                  </div>
                  {amount(row)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="text-muted-foreground min-w-0 text-xs wrap-anywhere">
                    Cerrado por {row.closedBy}
                  </p>
                  {action(row)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {data && (
        <fieldset disabled={busy}>
          <PaginationControls
            page={data.page + 1}
            totalPages={Math.max(1, Math.ceil(data.count / BILLING_PAGE_SIZE))}
            totalItems={data.count}
            pageSize={BILLING_PAGE_SIZE}
            onPageChange={(page) => onPage(page - 1)}
          />
        </fieldset>
      )}
    </section>
  )
}
