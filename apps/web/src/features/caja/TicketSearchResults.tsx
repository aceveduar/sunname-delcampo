import { useEffect, useRef, type MouseEvent } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { formatCurrency } from '@/lib/currency'
import { ticketPeriodLabel, ticketStatuses } from './ticketFilters'
import { TICKET_PAGE_SIZE, type TicketSearchResult } from './ticketSearch'

export function TicketSearchResults({
  data,
  loading,
  error,
  current,
  onRefresh,
  onPage,
  onReceipt,
}: {
  data: TicketSearchResult | null
  loading: boolean
  error: string | null
  current: boolean
  onRefresh: () => void
  onPage: (page: number) => void
  onReceipt: (id: string, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [data])
  const totalPages = Math.max(
    1,
    Math.ceil((data?.count ?? 0) / TICKET_PAGE_SIZE),
  )
  const disabled = loading || !current || !!error
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Resultados de tickets"
    >
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">
            {data
              ? `${data.count} ${data.count === 1 ? 'ticket' : 'tickets'}`
              : 'Resultados'}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw
              className={
                loading ? 'animate-spin motion-reduce:animate-none' : ''
              }
            />
            Actualizar
          </Button>
        </div>
        {data && (
          <p className="text-muted-foreground mt-1 text-xs wrap-break-word">
            {ticketPeriodLabel(data.query.values)} ·{' '}
            {
              ticketStatuses.find((s) => s.value === data.query.values.status)
                ?.label
            }
            {data.query.filters.total !== null &&
              ` · ${formatCurrency(data.query.filters.total)}`}
            {data.query.values.folio.trim() &&
              ` · Folio: ${data.query.values.folio.trim()}`}
          </p>
        )}
        <p role="status" className="text-muted-foreground mt-1 text-xs">
          {loading
            ? 'Buscando tickets…'
            : error && data
              ? 'Mostrando la última búsqueda correcta.'
              : ''}
        </p>
      </div>
      <div
        ref={listRef}
        role="region"
        aria-label="Lista de tickets"
        aria-busy={loading}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        <LoadError message={error} loading={loading} onRetry={onRefresh} />
        {!loading && !error && data?.count === 0 && (
          <EmptyState
            icon={ReceiptText}
            title="No hay tickets con estos filtros"
            description="Prueba otra fecha o revisa el importe y el folio."
          />
        )}
        <ol className="space-y-2">
          {data?.rows.map((sale) => (
            <li key={sale.id}>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Ver ticket ${sale.id.slice(0, 8)}`}
                onClick={(event) => onReceipt(sale.id, event)}
                className="border-border h-auto w-full flex-col items-stretch gap-2 rounded-xl border p-3 text-left whitespace-normal"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground text-xl font-semibold tabular-nums">
                    {formatCurrency(sale.total)}
                  </span>
                  <Badge
                    variant={
                      sale.status === 'voided' ? 'destructive' : 'secondary'
                    }
                  >
                    {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                  </Badge>
                </span>
                <span className="text-muted-foreground flex flex-wrap items-end justify-between gap-2 text-xs font-normal">
                  <span className="space-y-1">
                    <span className="block">
                      Folio{' '}
                      <span className="font-mono">{sale.id.slice(0, 8)}</span>
                    </span>
                    <time dateTime={sale.created_at} className="block">
                      {new Date(sale.created_at).toLocaleString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </span>
                  <span className="text-foreground inline-flex items-center gap-1 font-medium">
                    Ver ticket <ArrowRight className="size-3.5" />
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ol>
      </div>
      <nav
        aria-label="Páginas de tickets"
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t p-3 md:px-4"
      >
        <p className="text-muted-foreground text-xs tabular-nums">
          {data?.count
            ? `${data.page * TICKET_PAGE_SIZE + 1}–${Math.min((data.page + 1) * TICKET_PAGE_SIZE, data.count)} de ${data.count}`
            : '0 resultados'}
          {data && totalPages > 1 && (
            <span className="block">
              Página {data.page + 1} de {totalPages}
            </span>
          )}
        </p>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !data || data.page === 0}
            onClick={() => data && onPage(data.page - 1)}
          >
            <ChevronLeft />
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !data || data.page + 1 >= totalPages}
            onClick={() => data && onPage(data.page + 1)}
          >
            Siguiente
            <ChevronRight />
          </Button>
        </div>
      </nav>
    </section>
  )
}
