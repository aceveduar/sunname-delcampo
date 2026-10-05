import { useCallback, useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadError } from '@/components/LoadError'
import { EmptyState } from '@/components/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { formatCurrency } from '@/lib/currency'
import { SaleReceiptViewer } from './SaleReceiptViewer'

const PAGE_SIZE = 10
/** Interfaz de Caja para consultar compras asociadas desde CRM, con el mismo RLS que tickets. */
export function CustomerPurchaseHistory({
  customerId,
}: {
  customerId: string
}) {
  const [page, setPage] = useState(0)
  const [ticket, setTicket] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data, error, count } = await supabase
      .from('sales')
      .select('id,created_at,total,status', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    return { data: { rows: data ?? [], count: count ?? 0, page }, error }
  }, [customerId, page])
  const history = useAsyncResource(
    load,
    'No se pudieron cargar las compras del cliente',
    null,
  )
  return (
    <section className="space-y-4" aria-labelledby="customer-history-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="customer-history-title" className="font-semibold">
          Compras asociadas
        </h2>
        <Button
          size="sm"
          variant="outline"
          disabled={history.loading}
          onClick={() => void history.refresh()}
        >
          Actualizar
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Solo aparecen ventas en las que se asignó este cliente. Las anuladas se
        identifican por separado.
      </p>
      <LoadError
        message={history.error}
        onRetry={history.refresh}
        loading={history.loading}
      />
      {history.loading ? (
        <p role="status" className="text-muted-foreground text-sm">
          Cargando compras…
        </p>
      ) : (
        history.data && (
          <>
            {!history.data.count ? (
              <EmptyState
                icon={ReceiptText}
                title="Aún no hay compras asociadas"
                description="Asigna este cliente al cobrar en Caja para consultar aquí sus tickets."
              />
            ) : (
              <>
                <ul className="space-y-2">
                  {history.data.rows.map((sale) => (
                    <li key={sale.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(sale.created_at).toLocaleDateString(
                              'es-MX',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              },
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(sale.created_at).toLocaleTimeString(
                              'es-MX',
                              { hour: '2-digit', minute: '2-digit' },
                            )}{' '}
                            · {sale.id.slice(0, 8)}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">
                          {formatCurrency(sale.total)}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge
                          variant={
                            sale.status === 'voided'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {sale.status === 'voided' ? 'Anulada' : 'Completada'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTicket(sale.id)}
                        >
                          Ver ticket
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    {history.data.count}{' '}
                    {history.data.count === 1 ? 'compra' : 'compras'} · Página{' '}
                    {history.data.page + 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={history.data.page === 0 || !!history.error}
                      onClick={() => setPage(history.data!.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        (history.data.page + 1) * PAGE_SIZE >=
                          history.data.count || !!history.error
                      }
                      onClick={() => setPage(history.data!.page + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}
      {ticket && (
        <SaleReceiptViewer
          key={ticket}
          saleId={ticket}
          onClose={() => setTicket(null)}
        />
      )}
    </section>
  )
}
