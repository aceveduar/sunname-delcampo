import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { formatCurrency } from '@/lib/currency'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { fetchCashBalance } from './cashBalance'
import type { useCashMovement } from './useCashMovement'
import { CashMovementDialog } from './CashMovementDialog'

const PAGE_SIZE = 10
export function CashSessionSummary({
  sessionId,
  revision,
  movement,
}: {
  sessionId: string
  revision: number
  movement: ReturnType<typeof useCashMovement>
}) {
  const [page, setPage] = useState(0)
  const load = useCallback(async () => {
    const [balance, history] = await Promise.all([
      fetchCashBalance(sessionId),
      supabase
        .from('cash_movements')
        .select('id, direction, amount, reason, actor_name, created_at', {
          count: 'exact',
        })
        .eq('cash_session_id', sessionId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
    ])
    if (history.error) throw history.error
    return {
      data: { balance, items: history.data, count: history.count ?? 0, page },
      error: null,
    }
  }, [sessionId, page])
  const { data, loading, error, refresh, updatedAt } = useAsyncResource<
    Awaited<ReturnType<typeof load>>['data'] | null
  >(load, 'No se pudo actualizar el resumen de efectivo', null)
  useEffect(() => {
    if (revision > 0) void refresh()
  }, [revision, refresh])
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('online', refreshVisible)
    return () => {
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('online', refreshVisible)
    }
  }, [refresh])
  const saved = () => {
    toast.success('Movimiento de efectivo registrado')
    if (page === 0) void refresh()
    else setPage(0)
  }
  return (
    <section
      aria-label="Resumen de efectivo"
      className="space-y-2 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-muted-foreground text-xs font-medium">
            Efectivo esperado en caja
          </h2>
          {data && (
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(data.balance.expectedAmount)}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {updatedAt
              ? `Actualizado a las ${updatedAt.toLocaleTimeString('es-MX')}`
              : 'Consultando saldo…'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CashMovementDialog movement={movement} onSaved={saved} />
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
      </div>
      <LoadError message={error} loading={loading} onRetry={refresh} />
      {data && (
        <details className="border-t pt-2">
          <summary className="cursor-pointer text-sm font-medium">
            Ver desglose e historial ({data.count})
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Fondo inicial', data.balance.openingAmount],
              ['Ventas en efectivo', data.balance.cashSales],
              ['Entradas', data.balance.cashIn],
              ['Salidas', data.balance.cashOut],
            ].map(([label, amount]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold break-words">
                  {formatCurrency(Number(amount))}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 border-t pt-3">
            <h3 className="text-sm font-medium">Entradas y salidas</h3>
            {data.count === 0 ? (
              <p className="text-muted-foreground py-3 text-sm">
                Todavía no hay movimientos de efectivo.
              </p>
            ) : (
              <>
                <ul className="divide-y">
                  {data.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="break-words whitespace-pre-wrap">
                          {item.reason}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {item.actor_name} ·{' '}
                          {new Date(item.created_at).toLocaleString('es-MX')}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium">
                        {item.direction === 'in' ? 'Entrada +' : 'Salida −'}
                        {formatCurrency(item.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {data.page + 1} de{' '}
                    {Math.max(1, Math.ceil(data.count / PAGE_SIZE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || (page + 1) * PAGE_SIZE >= data.count}
                    onClick={() => setPage(page + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
