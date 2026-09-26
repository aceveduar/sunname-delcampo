import { TicketSearchDialog } from './TicketSearchDialog'
import { formatCurrency } from '@/lib/currency'
import { useEffect } from 'react'
import { LoadError } from '@/components/LoadError'
import { useCart } from './CartContext'
import type { Database } from '@/lib/database.types'
import { useCashSession } from './useCashSession'
import { OpenSessionCard } from './OpenSessionCard'
import { CloseSessionDialog } from './CloseSessionDialog'
import { SaleScreen } from './SaleScreen'

type Role = Database['public']['Enums']['user_role']

export function CajaPage({ role }: { role: Role | null }) {
  const { session, loading, error, refresh, openSession, closeSession } =
    useCashSession()
  const { resetSale, cart, pendingDraft } = useCart()
  useEffect(() => {
    if (!loading && !error && !session) resetSale()
  }, [loading, error, session, resetSale])

  if (error)
    return <LoadError message={error} onRetry={refresh} loading={loading} />

  if (loading) {
    return <p className="text-muted-foreground text-sm">Cargando…</p>
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Caja</h1>
          <p className="text-muted-foreground text-sm">
            No hay una caja abierta ahora mismo.
          </p>
        </div>
        <div>
          <TicketSearchDialog />
        </div>
        <OpenSessionCard onOpen={openSession} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Caja</h1>
          <p className="text-muted-foreground text-sm">
            Abierta a las{' '}
            {new Date(session.opened_at).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            con {formatCurrency(session.opening_amount)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <TicketSearchDialog />
          <CloseSessionDialog
            key={session.id}
            sessionId={session.id}
            onClose={closeSession}
            disabled={cart.length > 0 || !!pendingDraft}
          />
          {(cart.length > 0 || pendingDraft) && (
            <p className="text-muted-foreground mt-1 max-w-xs text-xs">
              Termina o descarta la venta pendiente antes de cerrar caja.
            </p>
          )}
        </div>
      </div>

      <SaleScreen cashSessionId={session.id} role={role} />
    </div>
  )
}
