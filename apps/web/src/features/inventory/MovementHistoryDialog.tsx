import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import type { Database } from '@/lib/database.types'

type Movement = Pick<
  Database['public']['Tables']['inventory_movements']['Row'],
  | 'id'
  | 'type'
  | 'quantity'
  | 'created_at'
  | 'notes'
  | 'reference_type'
  | 'reference_id'
> & { actor: { full_name: string } | null }
const PAGE_SIZE = 30
const sourceLabels: Record<string, string> = {
  sale: 'Venta',
  sale_void: 'Anulación de venta',
  purchase: 'Compra',
  adjustment: 'Ajuste',
}
export function MovementHistoryDialog({
  productId,
  productName,
  unit,
  onClose,
}: {
  productId: string
  productName: string
  unit: string
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const fetcher = useCallback(async () => {
    const { data, error, count } = await supabase
      .from('inventory_movements')
      .select(
        'id, type, quantity, created_at, notes, reference_type, reference_id, actor:profiles(full_name)',
        { count: 'exact' },
      )
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    return {
      data: { rows: (data ?? []) as Movement[], count: count ?? 0, page },
      error,
    }
  }, [productId, page])
  const { data, loading, error, refresh } = useAsyncResource(
    fetcher,
    'No se pudo cargar el historial',
    { rows: [] as Movement[], count: 0, page: 0 },
  )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Movimientos de {productName}</DialogTitle>
          <DialogDescription>
            Entradas, salidas y ajustes registrados. Las correcciones conservan
            los movimientos anteriores.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-between gap-2">
          <span className="text-sm">{data.count} movimientos</span>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            Actualizar
          </Button>
        </div>
        <LoadError message={error} loading={loading} onRetry={refresh} />
        {loading && <p role="status">Cargando movimientos…</p>}
        {!loading && !error && data.rows.length === 0 && (
          <p>No hay movimientos registrados.</p>
        )}
        <ol className="space-y-3">
          {data.rows.map((row) => {
            const delta = row.type === 'out' ? -row.quantity : row.quantity
            return (
              <li
                key={row.id}
                className="space-y-1 rounded-lg border p-3 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {sourceLabels[row.reference_type ?? ''] ??
                      (row.type === 'in'
                        ? 'Entrada manual'
                        : row.type === 'out'
                          ? 'Salida manual'
                          : 'Ajuste manual')}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {delta > 0 ? '+' : ''}
                    {delta} {unit}
                  </span>
                </div>
                <p>
                  {new Date(row.created_at).toLocaleString('es-MX')} ·{' '}
                  {row.actor?.full_name ?? 'Responsable no disponible'}
                </p>
                {row.reference_id && (
                  <p className="text-muted-foreground">
                    Referencia: {row.reference_id.slice(0, 8)}
                  </p>
                )}
                <p className="wrap-break-word whitespace-pre-wrap">
                  {row.notes || 'Sin observación adicional'}
                </p>
              </li>
            )
          })}
        </ol>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={loading || data.page === 0}
            onClick={() => setPage(data.page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm">
            Página {data.page + 1} de{' '}
            {Math.max(1, Math.ceil(data.count / PAGE_SIZE))}
          </span>
          <Button
            variant="outline"
            disabled={loading || (data.page + 1) * PAGE_SIZE >= data.count}
            onClick={() => setPage(data.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
