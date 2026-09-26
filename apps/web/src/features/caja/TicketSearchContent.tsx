import { useCallback, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadError } from '@/components/LoadError'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { formatCurrency } from '@/lib/currency'
import { localDateValue } from '@/lib/dateRange'
import { ticketFilters } from './ticketFilters'
import { SaleReceiptViewer } from './SaleReceiptViewer'

type Ticket = { id: string; created_at: string; total: number; status: string }
const PAGE_SIZE = 20
export function TicketSearchContent({ onClose }: { onClose: () => void }) {
  const today = localDateValue(new Date())
  const [start, setStart] = useState(today),
    [end, setEnd] = useState(today)
  const [amount, setAmount] = useState(''),
    [folio, setFolio] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [query, setQuery] = useState(() => ({
    filters: ticketFilters(today, today, '', ''),
    page: 0,
    revision: 0,
  }))
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const fetcher = useCallback(async () => {
    const filters = query.filters
    let request = supabase
      .from('sales')
      .select('id, created_at, total, status', { count: 'exact' })
      .gte('created_at', filters.from)
      .lt('created_at', filters.to)
    if (filters.total !== null) request = request.eq('total', filters.total)
    if (filters.lowerId && filters.upperId)
      request = request.gte('id', filters.lowerId).lte('id', filters.upperId)
    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(query.page * PAGE_SIZE, (query.page + 1) * PAGE_SIZE - 1)
    return {
      data: {
        rows: (data ?? []) as Ticket[],
        count: count ?? 0,
        page: query.page,
      },
      error,
    }
  }, [query])
  const { data, loading, error, refresh } = useAsyncResource(
    fetcher,
    'No se pudieron buscar los tickets',
    { rows: [] as Ticket[], count: 0, page: 0 },
  )
  const search = (event: FormEvent) => {
    event.preventDefault()
    try {
      const filters = ticketFilters(start, end, amount, folio)
      setValidationError(null)
      setQuery((previous) => ({
        filters,
        page: 0,
        revision: previous.revision + 1,
      }))
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Revisa los filtros',
      )
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !receiptId) onClose()
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Buscar tickets</DialogTitle>
            <DialogDescription>
              Consulta ventas por fecha, importe exacto o los primeros
              caracteres del folio. Abrir un ticket no realiza ningún cobro.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={search} className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ticket-start">Desde</Label>
              <Input
                id="ticket-start"
                type="date"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ticket-end">Hasta</Label>
              <Input
                id="ticket-end"
                type="date"
                required
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ticket-amount">Importe exacto</Label>
              <Input
                id="ticket-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Cualquier importe"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ticket-folio">Folio</Label>
              <Input
                id="ticket-folio"
                placeholder="Ej. a12b34cd"
                value={folio}
                onChange={(event) => setFolio(event.target.value)}
              />
            </div>
            {validationError && (
              <p role="alert" className="text-destructive col-span-2 text-sm">
                {validationError}
              </p>
            )}
            <Button type="submit" className="col-span-2" disabled={loading}>
              Buscar tickets
            </Button>
          </form>
          <LoadError message={error} onRetry={refresh} loading={loading} />
          {loading && <p role="status">Buscando…</p>}
          {!loading && !error && data.count === 0 && (
            <p>No hay ventas con estos filtros.</p>
          )}
          <ol className="space-y-2">
            {data.rows.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    Folio {sale.id.slice(0, 8)} · {formatCurrency(sale.total)}
                  </p>
                  <p>{new Date(sale.created_at).toLocaleString('es-MX')}</p>
                  <p>
                    {sale.status === 'voided' ? 'Venta anulada' : 'Completada'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptId(sale.id)}
                >
                  Ver ticket
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={loading || data.page === 0}
              onClick={() =>
                setQuery((previous) => ({ ...previous, page: data.page - 1 }))
              }
            >
              Anterior
            </Button>
            <span className="text-sm">
              {data.count} ventas · {data.page + 1}/
              {Math.max(1, Math.ceil(data.count / PAGE_SIZE))}
            </span>
            <Button
              variant="outline"
              disabled={loading || (data.page + 1) * PAGE_SIZE >= data.count}
              onClick={() =>
                setQuery((previous) => ({ ...previous, page: data.page + 1 }))
              }
            >
              Siguiente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {receiptId && (
        <SaleReceiptViewer
          key={receiptId}
          saleId={receiptId}
          onClose={() => setReceiptId(null)}
        />
      )}
    </>
  )
}
