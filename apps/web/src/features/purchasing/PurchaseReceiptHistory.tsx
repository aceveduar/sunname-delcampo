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
    return {
      data: data ? { items: data, count: count ?? 0, page } : null,
      error,
    }
  }, [orderId, page])
  const { data, error, loading, refresh } = useAsyncResource<NonNullable<
    Awaited<ReturnType<typeof load>>['data']
  > | null>(load, 'No se pudo consultar el historial de entregas', null)
  return (
    <section className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">Entregas registradas</h3>
      <LoadError message={error} loading={loading} onRetry={refresh} />
      {loading && !data && (
        <p role="status" className="text-sm">
          Consultando entregas…
        </p>
      )}
      {data && data.count === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay entregas registradas. Las compras recibidas antes de esta
          función no tienen desglose histórico.
        </p>
      )}
      {data?.items.map((receipt) => (
        <article
          key={receipt.id}
          className="space-y-1 rounded-md border p-3 text-sm"
        >
          <p className="font-medium">
            {new Date(receipt.created_at).toLocaleString('es-MX')}
          </p>
          <p className="text-muted-foreground">{receipt.actor_name}</p>
          <ul>
            {Array.isArray(receipt.items) &&
              receipt.items.map((item, index) => {
                if (!item || typeof item !== 'object' || Array.isArray(item))
                  return null
                return (
                  <li key={index}>
                    {String(item.product_name ?? 'Producto')}:{' '}
                    {String(item.quantity ?? '')}
                  </li>
                )
              })}
          </ul>
          {receipt.notes && (
            <p className="break-words whitespace-pre-wrap">{receipt.notes}</p>
          )}
        </article>
      ))}
      {data && data.count > 10 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs">
            Página {data.page + 1} de {Math.ceil(data.count / 10)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || (page + 1) * 10 >= data.count}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </section>
  )
}
