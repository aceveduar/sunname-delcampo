import { formatCurrency } from '@/lib/currency'
import type { Database } from '@/lib/database.types'
import { useCashSession } from './useCashSession'
import { OpenSessionCard } from './OpenSessionCard'
import { CloseSessionDialog } from './CloseSessionDialog'
import { SaleScreen } from './SaleScreen'

type Role = Database['public']['Enums']['user_role']

export function CajaPage({ role }: { role: Role | null }) {
  const { session, loading, openSession, closeSession } = useCashSession()

  if (loading) {
    return <p className="text-muted-foreground text-sm">Cargando…</p>
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Caja</h1>
          <p className="text-muted-foreground text-sm">No hay una caja abierta ahora mismo.</p>
        </div>
        <OpenSessionCard onOpen={openSession} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Caja</h1>
          <p className="text-muted-foreground text-sm">
            Abierta a las{' '}
            {new Date(session.opened_at).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            con {formatCurrency(session.opening_amount)}.
          </p>
        </div>
        <div className="self-start">
          <CloseSessionDialog onClose={closeSession} />
        </div>
      </div>

      <SaleScreen cashSessionId={session.id} role={role} />
    </div>
  )
}
