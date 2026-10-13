import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'

export function PurchaseReceiptHistory({ orderId }: { orderId: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback(async () => {
    const { data, error, count } = await supabase
      .from('purchase_receipts')
      .select('id, created_at, actor_name, notes, items', { count: 'exact' })
      .eq('purchase_order_id', orderId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * 10, page * 10 + 9)
    if (!error && (data === null || count === null))
      throw new Error('Respuesta incompleta del historial')
    return {
      data: data ? { items: data, count: count ?? 0, page } : null,
      error,
    }
  }, [orderId, page])
  const { data, error, loading, refresh } = useAsyncResource<NonNullable<
    Awaited<ReturnType<typeof load>>['data']
  > | null>(load, 'No se pudo consultar el historial de entregas', null)
  const ready = !!data && !loading && !error && data.page === page
  return (
    <section
      className="space-y-3 border-t pt-3"
      aria-label="Historial de entregas"
    >
      <h3 className="text-sm font-semibold">Entregas registradas</h3>
      <LoadError message={error} loading={loading} onRetry={refresh} />
      {loading && (
        <p role="status" className="text-muted-foreground text-sm">
          {data ? 'Actualizando entregas…' : 'Consultando entregas…'}
        </p>
      )}
      {error && data && (
        <p className="text-muted-foreground text-sm">
          Mostrando la última página consultada correctamente.
        </p>
      )}
      {ready && data.count === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay entregas registradas. Las compras recibidas antes de esta
          función no tienen desglose histórico.
        </p>
      )}
      {data?.items.map((receipt) => (
        <article
          key={receipt.id}
          className="bg-card space-y-2 rounded-lg border p-3 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold wrap-anywhere">{receipt.actor_name}</p>
            <time
              className="text-muted-foreground text-xs"
              dateTime={receipt.created_at}
            >
              {new Date(receipt.created_at).toLocaleString('es-MX')}
            </time>
          </div>
          <ul className="space-y-1">
            {Array.isArray(receipt.items) &&
              receipt.items.map((item, index) => {
                if (!item || typeof item !== 'object' || Array.isArray(item))
                  return null
                return (
                  <li
                    key={index}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="min-w-0 wrap-anywhere">
                      {String(item.product_name ?? 'Producto')}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {typeof item.quantity === 'number' &&
                      Number.isFinite(item.quantity)
                        ? item.quantity
                        : '—'}
                    </span>
                  </li>
                )
              })}
          </ul>
          {receipt.notes && (
            <p className="bg-muted/50 rounded-md p-2 wrap-anywhere whitespace-pre-wrap">
              {receipt.notes}
            </p>
          )}
        </article>
      ))}
      {data && data.count > 10 && (
        <nav
          aria-label="Paginación de entregas"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            size="sm"
            variant="outline"
            disabled={!ready || data.page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-xs">
            Página {data.page + 1} de {Math.ceil(data.count / 10)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!ready || (data.page + 1) * 10 >= data.count}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </nav>
      )}
    </section>
  )
}
