import { PageHeader } from '@/components/PageHeader'
import { Store } from 'lucide-react'
import { TicketSearchDialog } from './TicketSearchDialog'
import { formatCurrency } from '@/lib/currency'
import { useCallback, useEffect, useState } from 'react'
import { CashManagementDialog } from './CashManagementDialog'
import { LoadError } from '@/components/LoadError'
import { useCart } from './CartContext'
import type { Database } from '@/lib/database.types'
import { useCashSession } from './useCashSession'
import { OpenSessionCard } from './OpenSessionCard'
import { CloseSessionDialog } from './CloseSessionDialog'
import { SaleScreen } from './SaleScreen'

type Role = Database['public']['Enums']['user_role']

export function CajaPage({
  role,
  userId,
}: {
  role: Role | null
  userId: string
}) {
  const [cashRevision, setCashRevision] = useState(0)
  const [movementPending, setMovementPending] = useState(true)
  const onSaleRecorded = useCallback(
    () => setCashRevision((value) => value + 1),
    [],
  )
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
      <div className="flex flex-col gap-4">
        <PageHeader
          compact
          icon={Store}
          title="Caja"
          description="No hay una caja abierta ahora mismo."
        />
        <div>
          <TicketSearchDialog />
        </div>
        <OpenSessionCard onOpen={openSession} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          compact
          icon={Store}
          title="Caja"
          description={
            <>
              Abierta a las{' '}
              {new Date(session.opened_at).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              con {formatCurrency(session.opening_amount)}.
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2 self-start">
          <CashManagementDialog
            key={`${session.id}:${userId}`}
            sessionId={session.id}
            userId={userId}
            revision={cashRevision}
            onPendingChange={setMovementPending}
          />
          <TicketSearchDialog />
          <CloseSessionDialog
            key={session.id}
            sessionId={session.id}
            onClose={closeSession}
            disabled={cart.length > 0 || !!pendingDraft || movementPending}
          />
          {(cart.length > 0 || pendingDraft) && (
            <p className="text-muted-foreground mt-1 max-w-xs text-xs">
              Termina o descarta la venta pendiente antes de cerrar caja.
            </p>
          )}
        </div>
      </div>

      <SaleScreen
        userId={userId}
        cashSessionId={session.id}
        role={role}
        onSaleRecorded={onSaleRecorded}
      />
    </div>
  )
}
