import { useCallback, useRef, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { initialTicketValues, type TicketSearchValues } from './ticketFilters'
import {
  createTicketQuery,
  loadTickets,
  type TicketSearchResult,
} from './ticketSearch'
import { TicketSearchFilters } from './TicketSearchFilters'
import { TicketSearchResults } from './TicketSearchResults'
import { SaleReceiptViewer } from './SaleReceiptViewer'

export function TicketSearchContent({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState(initialTicketValues)
  const [query, setQuery] = useState(() => createTicketQuery(values))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const receiptTrigger = useRef<HTMLButtonElement | null>(null)
  const fetcher = useCallback(
    async () => ({
      data: await loadTickets(query),
      error: null,
    }),
    [query],
  )
  const { data, loading, error, refresh } =
    useAsyncResource<TicketSearchResult | null>(
      fetcher,
      'No se pudieron buscar los tickets',
      null,
    )
  const search = (next: TicketSearchValues) => {
    try {
      setQuery(createTicketQuery(next))
      setValidationError(null)
      return true
    } catch (cause) {
      setValidationError(
        cause instanceof Error ? cause.message : 'Revisa los filtros',
      )
      return false
    }
  }
  const dirty = (Object.keys(values) as (keyof TicketSearchValues)[]).some(
    (key) => values[key] !== query.values[key],
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !receiptId) onClose()
      }}
    >
      <DialogContent className="flex h-[92dvh] max-h-[54rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b p-4 pr-12">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="text-primary size-5" />
            Buscar tickets
          </DialogTitle>
          <DialogDescription className="sr-only sm:not-sr-only">
            Encuentra una venta y vuelve a imprimir su ticket.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[17.5rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
          <TicketSearchFilters
            values={values}
            onChange={(next) => {
              setValues(next)
              setValidationError(null)
            }}
            onSearch={search}
            loading={loading}
            error={validationError}
            dirty={dirty}
          />
          <TicketSearchResults
            data={data}
            loading={loading}
            error={error}
            current={data?.query === query}
            onRefresh={() => void refresh()}
            onPage={(page) => setQuery((previous) => ({ ...previous, page }))}
            onReceipt={(id, event) => {
              receiptTrigger.current = event.currentTarget
              setReceiptId(id)
            }}
          />
        </div>
      </DialogContent>
      {receiptId && (
        <SaleReceiptViewer
          key={receiptId}
          saleId={receiptId}
          returnFocus={receiptTrigger}
          onClose={() => setReceiptId(null)}
        />
      )}
    </Dialog>
  )
}
