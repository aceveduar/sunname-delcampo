import { useState } from 'react'
import { FileWarning, ReceiptText, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { useTenantFiscalSettings } from '@/features/settings/useTenantFiscalSettings'
import { useFiscalInvoices } from './useFiscalInvoices'
import {
  createBillingQuery,
  INITIAL_BILLING_VALUES,
  type BillingValues,
} from './billingData'
import { BillingFilters } from './BillingFilters'
import { BillingSessions } from './BillingSessions'
import { BillingSessionDialog } from './BillingSessionDialog'

export function BillingPage({
  canConfigure = false,
}: {
  canConfigure?: boolean
}) {
  const fiscal = useTenantFiscalSettings()
  const [query, setQuery] = useState(() =>
    createBillingQuery(INITIAL_BILLING_VALUES),
  )
  const { data, loading, error, refresh } = useFiscalInvoices(query)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const current = data?.query === query
  const apply = (values: BillingValues) => {
    try {
      setQuery(createBillingQuery(values))
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Revisa los filtros.'
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ReceiptText}
        title="Facturación"
        description="Revisa los cortes y da seguimiento a cada solicitud."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        }
      />
      <LoadError
        message={fiscal.error}
        onRetry={fiscal.refresh}
        loading={fiscal.loading}
      />
      {!fiscal.loading && !fiscal.error && !fiscal.isComplete && (
        <div className="border-brand-gold/30 bg-brand-gold/10 flex items-start gap-3 rounded-xl border p-4">
          <FileWarning className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Faltan datos fiscales del negocio</p>
            <p>
              {canConfigure ? (
                <>
                  Completa RFC, razón social, régimen fiscal y código postal en{' '}
                  <Link to="/configuracion" className="underline">
                    Configuración
                  </Link>
                  .
                </>
              ) : (
                'Pide al propietario que complete los datos fiscales en Configuración.'
              )}{' '}
              Puedes consultar los cortes mientras tanto.
            </p>
          </div>
        </div>
      )}
      <div className="bg-muted/40 rounded-xl border p-4 text-sm">
        <p className="font-medium">Solicitudes pendientes de timbrado</p>
        <p className="text-muted-foreground mt-1">
          El timbrado con un PAC todavía no está conectado. Registrar una
          solicitud la guarda como pendiente; no genera una factura timbrada.
        </p>
      </div>
      <BillingFilters loading={loading} onApply={apply} />
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <BillingSessions
        data={data}
        loading={loading}
        error={error}
        current={current}
        onPage={(page) => {
          if (!loading && !error && current)
            setQuery((previous) => ({ ...previous, page }))
        }}
        onOpen={(id) => setSelectedId(id)}
      />
      {selectedId && (
        <BillingSessionDialog
          key={selectedId}
          sessionId={selectedId}
          canRequest={fiscal.isComplete}
          onChanged={refresh}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
