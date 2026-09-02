import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import type { Database } from '@/lib/database.types'

type InvoiceStatus = Database['public']['Enums']['fiscal_invoice_status']

export type BillableSession = {
  cashSessionId: string
  closedAt: string
  closedBy: string
  amount: number
  invoice: {
    id: string
    status: InvoiceStatus
    total: number
    uuidFiscal: string | null
    errorMessage: string | null
  } | null
}

// Últimos 20 cortes cerrados, con su factura global si ya se solicitó
// una -- no está atado al filtro de periodo de Reportes a propósito,
// Facturación es su propio flujo (solicitar/revisar estado), no un
// reporte de ventas.
export function useFiscalInvoices() {
  const [sessions, setSessions] = useState<BillableSession[]>([])
  const [loading, setLoading] = useState(true)
  const [requestingId, setRequestingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cash_sessions')
      .select(
        'id, closed_at, closing_amount, closed_by:profiles!cash_sessions_closed_by_fkey(full_name), fiscal_invoices(id, status, total, uuid_fiscal, error_message)',
      )
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(20)

    if (error) {
      reportError('No se pudieron cargar los cortes de caja', error)
    } else {
      setSessions(
        (data ?? []).map((row) => ({
          cashSessionId: row.id,
          closedAt: row.closed_at ?? '',
          closedBy: row.closed_by?.full_name ?? '—',
          amount: row.closing_amount ?? 0,
          invoice: row.fiscal_invoices
            ? {
                id: row.fiscal_invoices.id,
                status: row.fiscal_invoices.status,
                total: row.fiscal_invoices.total,
                uuidFiscal: row.fiscal_invoices.uuid_fiscal,
                errorMessage: row.fiscal_invoices.error_message,
              }
            : null,
        })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requestInvoice = useCallback(
    async (cashSessionId: string) => {
      setRequestingId(cashSessionId)
      const { error } = await supabase.rpc('request_global_invoice', {
        p_cash_session_id: cashSessionId,
      })
      setRequestingId(null)
      if (error) {
        reportError('No se pudo solicitar la factura', error)
        return false
      }
      toast.success('Factura solicitada — pendiente de timbrado')
      await refresh()
      return true
    },
    [refresh],
  )

  return { sessions, loading, requestingId, requestInvoice }
}
