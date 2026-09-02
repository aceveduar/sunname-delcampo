import { Link } from 'react-router-dom'
import { FileWarning, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { EmptyState } from '@/components/EmptyState'
import { formatCurrency } from '@/lib/currency'
import { useTenantFiscalSettings } from '@/features/settings/useTenantFiscalSettings'
import { useFiscalInvoices, type BillableSession } from './useFiscalInvoices'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InvoiceStatusBadge({
  invoice,
}: {
  invoice: BillableSession['invoice']
}) {
  if (!invoice) return <Badge variant="outline">Sin solicitar</Badge>
  switch (invoice.status) {
    case 'pending':
      return <Badge variant="secondary">Pendiente de timbrado</Badge>
    case 'stamped':
      return <Badge>Timbrada</Badge>
    case 'error':
      return <Badge variant="destructive">Error</Badge>
    case 'cancelled':
      return <Badge variant="secondary">Cancelada</Badge>
  }
}

export function BillingPage() {
  const { isComplete, loading: loadingFiscal } = useTenantFiscalSettings()
  const { sessions, loading, requestingId, requestInvoice } =
    useFiscalInvoices()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Facturación
        </h1>
        <p className="text-muted-foreground text-sm">
          Factura global CFDI 4.0 por corte de caja.
        </p>
      </div>

      {!loadingFiscal && !isComplete && (
        <div className="border-destructive/30 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4">
          <FileWarning className="text-destructive mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              Faltan datos fiscales del negocio
            </p>
            <p className="text-muted-foreground text-sm">
              Completa RFC, razón social, régimen fiscal y código postal en{' '}
              <Link to="/configuracion" className="text-primary underline">
                Configuración
              </Link>{' '}
              antes de poder solicitar una factura.
            </p>
          </div>
        </div>
      )}

      <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm">
        <p className="text-muted-foreground">
          El timbrado con un proveedor autorizado (PAC) todavía no está
          conectado -- solicitar una factura aquí la deja registrada como{' '}
          <span className="font-medium">pendiente</span>, lista para cuando
          esa conexión exista.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cerrado</TableHead>
            <TableHead>Cerrado por</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Factura</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableSkeletonRows rows={5} columns={5} />}
          {!loading && sessions.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState
                  icon={Receipt}
                  title="Sin cortes de caja cerrados"
                  description="En cuanto cierres un corte de caja, aparecerá aquí para poder facturarlo."
                />
              </TableCell>
            </TableRow>
          )}
          {sessions.map((session) => (
            <TableRow key={session.cashSessionId}>
              <TableCell>{formatDateTime(session.closedAt)}</TableCell>
              <TableCell>{session.closedBy}</TableCell>
              <TableCell>{formatCurrency(session.amount)}</TableCell>
              <TableCell>
                <InvoiceStatusBadge invoice={session.invoice} />
              </TableCell>
              <TableCell className="text-right">
                {!session.invoice && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      !isComplete || requestingId === session.cashSessionId
                    }
                    onClick={() => requestInvoice(session.cashSessionId)}
                  >
                    Solicitar factura global
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
