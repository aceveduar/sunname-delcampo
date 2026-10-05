import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  LayoutDashboard,
  RefreshCw,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadError } from '@/components/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { formatCurrency } from '@/lib/currency'
import { loadDailyOverview } from '@/features/reports/dailyOverview'
import { loadInventoryAttention } from '@/features/inventory/attentionOverview'
import { loadPendingPurchases } from '@/features/purchasing/pendingOverview'

const linkClass =
  'text-foreground hover:underline inline-flex items-center gap-2 text-sm font-medium underline-offset-4'
function Updated({ date }: { date: Date | null }) {
  return (
    <p className="text-muted-foreground mt-4 text-xs">
      {date
        ? 'Actualizado a las ' +
          date.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Pendiente de cargar'}
    </p>
  )
}
export function OperationsHome({
  purchasingEnabled,
}: {
  purchasingEnabled: boolean
}) {
  const sales = useAsyncResource(
    useCallback(
      async () => ({ data: await loadDailyOverview(), error: null }),
      [],
    ),
    'No se pudieron cargar las ventas del día',
    null,
  )
  const stock = useAsyncResource(
    useCallback(
      async () => ({ data: await loadInventoryAttention(), error: null }),
      [],
    ),
    'No se pudieron cargar los pendientes de inventario',
    null,
  )
  const purchases = useAsyncResource(
    useCallback(
      async () => ({
        data: purchasingEnabled
          ? await loadPendingPurchases()
          : { count: 0, items: [] },
        error: null,
      }),
      [purchasingEnabled],
    ),
    'No se pudieron cargar las compras pendientes',
    null,
  )
  const loading =
    sales.loading || stock.loading || (purchasingEnabled && purchases.loading)
  const refresh = () => {
    void sales.refresh()
    void stock.refresh()
    if (purchasingEnabled) void purchases.refresh()
  }
  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Inicio"
        description="Tu negocio, de un vistazo. Revisa el día y decide qué sigue."
        actions={
          <Button variant="outline" disabled={loading} onClick={refresh}>
            <RefreshCw className="size-4" />
            {loading ? 'Actualizando…' : 'Actualizar resumen'}
          </Button>
        }
      />
      <LoadError
        message={sales.error}
        onRetry={sales.refresh}
        loading={sales.loading}
      />
      <section
        aria-label="Ventas del día"
        className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"
      >
        <div className="bg-sidebar text-sidebar-foreground border-sidebar-border rounded-2xl border p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sidebar-foreground/80 text-sm">
              Ventas completadas ·{' '}
              {sales.data
                ? new Date(sales.data.date).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                  })
                : 'hoy'}
            </p>
            <Banknote aria-hidden className="text-sidebar-primary size-6" />
          </div>
          <div className="my-4 text-4xl font-semibold tracking-tight wrap-break-word tabular-nums sm:text-5xl">
            {sales.loading ? (
              <Skeleton className="h-12 w-48" />
            ) : sales.data ? (
              formatCurrency(sales.data.total)
            ) : (
              '—'
            )}
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <p>
              <span className="font-semibold">
                {sales.data?.tickets ?? '—'}
              </span>{' '}
              tickets completados
            </p>
            <p>
              Ticket promedio{' '}
              <span className="font-semibold">
                {sales.data ? formatCurrency(sales.data.average) : '—'}
              </span>
            </p>
          </div>
          <p className="text-sidebar-foreground/70 mt-4 text-xs">
            Sin ventas anuladas.{' '}
            {sales.updatedAt
              ? 'Actualizado a las ' +
                sales.updatedAt.toLocaleTimeString('es-MX', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Pendiente de cargar.'}
          </p>
        </div>
        <div className="bg-card flex flex-col justify-between gap-5 rounded-2xl border p-6">
          <div>
            <Store aria-hidden className="text-primary mb-3 size-6" />
            <h2 className="text-lg font-semibold">Continúa tu operación</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Abre Caja para atender la siguiente venta o consulta el detalle
              del día.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button render={<Link to="/caja" />}>
              Ir a Caja <ArrowRight className="size-4" />
            </Button>
            <Link className={linkClass} to="/reportes">
              Ver reportes <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section
          className="bg-card rounded-2xl border p-5 sm:p-6"
          aria-labelledby="stock-attention-title"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="bg-primary/8 text-primary rounded-xl p-3">
              <Boxes aria-hidden className="size-5" />
            </span>
            <div>
              <h2 id="stock-attention-title" className="text-lg font-semibold">
                Inventario por revisar
              </h2>
              <p className="text-muted-foreground text-sm">
                Productos activos con control de existencias.
              </p>
            </div>
          </div>
          <LoadError
            message={stock.error}
            onRetry={stock.refresh}
            loading={stock.loading}
          />
          {stock.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            stock.data && (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <Link
                    to="/inventario?stock=out"
                    className="bg-muted/50 hover:bg-muted rounded-xl border p-4"
                  >
                    <span className="block text-2xl font-semibold tabular-nums">
                      {stock.data.out}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      Sin existencias
                    </span>
                  </Link>
                  <Link
                    to="/inventario?stock=low"
                    className="bg-muted/50 hover:bg-muted rounded-xl border p-4"
                  >
                    <span className="block text-2xl font-semibold tabular-nums">
                      {stock.data.low}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      En mínimo o menos
                    </span>
                  </Link>
                </div>
                {stock.data.total ? (
                  <ul className="divide-y">
                    {stock.data.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 py-3 text-sm"
                      >
                        <span className="min-w-0 wrap-break-word">
                          {item.name}
                        </span>
                        <span
                          className={
                            'shrink-0 text-xs ' +
                            (item.quantity <= 0
                              ? 'text-destructive'
                              : 'text-muted-foreground')
                          }
                        >
                          {item.quantity <= 0 ? 'Agotado' : 'En mínimo'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                    <CheckCircle2
                      aria-hidden
                      className="text-success size-5 shrink-0"
                    />
                    Sin faltantes según tus mínimos actuales.
                  </p>
                )}
                <Link to="/inventario" className={linkClass}>
                  Revisar inventario <ArrowRight className="size-4" />
                </Link>
              </>
            )
          )}
          <Updated date={stock.updatedAt} />
        </section>
        {purchasingEnabled && (
          <section
            className="bg-card rounded-2xl border p-5 sm:p-6"
            aria-labelledby="purchases-attention-title"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="bg-primary/8 text-primary rounded-xl p-3">
                <ShoppingCart aria-hidden className="size-5" />
              </span>
              <div>
                <h2
                  id="purchases-attention-title"
                  className="text-lg font-semibold"
                >
                  Compras por recibir
                </h2>
                <p className="text-muted-foreground text-sm">
                  Incluye órdenes con entregas parciales.
                </p>
              </div>
            </div>
            <LoadError
              message={purchases.error}
              onRetry={purchases.refresh}
              loading={purchases.loading}
            />
            {purchases.loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              purchases.data && (
                <>
                  <p className="mb-3 text-3xl font-semibold tabular-nums">
                    {purchases.data.count}{' '}
                    <span className="text-muted-foreground text-sm font-normal">
                      {purchases.data.count === 1
                        ? 'orden pendiente'
                        : 'órdenes pendientes'}
                    </span>
                  </p>
                  {purchases.data.count ? (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Las más antiguas primero
                      </p>
                      <ul className="mb-4 divide-y">
                        {purchases.data.items.map((item) => (
                          <li key={item.id}>
                            <Link
                              to={
                                '/compras?purchaseStatus=pending&supplierQuery=' +
                                item.id
                              }
                              className="hover:bg-muted flex items-center justify-between gap-3 rounded-md py-3 text-sm"
                            >
                              <span className="min-w-0">
                                <span className="block font-medium wrap-break-word">
                                  {item.supplier?.name ?? 'Proveedor'}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {new Date(item.created_at).toLocaleDateString(
                                    'es-MX',
                                  )}{' '}
                                  · {item.id.slice(0, 8)}
                                </span>
                              </span>
                              <ArrowRight
                                aria-hidden
                                className="size-4 shrink-0"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                      <CheckCircle2
                        aria-hidden
                        className="text-success size-5 shrink-0"
                      />
                      Todas tus compras están al día.
                    </p>
                  )}
                  <Link
                    to="/compras?purchaseStatus=pending"
                    className={linkClass}
                  >
                    Revisar compras <ArrowRight className="size-4" />
                  </Link>
                </>
              )
            )}
            <Updated date={purchases.updatedAt} />
          </section>
        )}
      </div>
    </div>
  )
}
