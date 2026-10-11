import { supabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/readAllPages'
import { reportRange } from '@/lib/dateRange'
import type { Database } from '@/lib/database.types'

export type InvoiceStatus = Database['public']['Enums']['fiscal_invoice_status']
export type Invoice = Pick<
  Database['public']['Tables']['fiscal_invoices']['Row'],
  'id' | 'status' | 'total' | 'uuid_fiscal' | 'error_message' | 'requested_at'
>
export type BillingValues = {
  start: string
  end: string
  status: 'all' | 'none' | InvoiceStatus
}
export const BILLING_PAGE_SIZE = 20
export const INITIAL_BILLING_VALUES: BillingValues = {
  start: '',
  end: '',
  status: 'all',
}
export const BILLING_STATUSES = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'none', label: 'Sin solicitar' },
  { value: 'pending', label: 'Pendiente de timbrado' },
  { value: 'stamped', label: 'Timbrada' },
  { value: 'error', label: 'Con error' },
  { value: 'cancelled', label: 'Cancelada' },
]
const INVOICE_COLUMNS =
  'id, status, total, uuid_fiscal, error_message, requested_at' as const
const SESSION_COLUMNS =
  'id, closed_at, closing_amount, closed_by:profiles!cash_sessions_closed_by_fkey(full_name), fiscal_invoices(id, status, total, uuid_fiscal, error_message, requested_at)' as const

export type BillableSession = {
  cashSessionId: string
  closedAt: string
  closedBy: string
  cashCounted: number | null
  salesTotal: number
  saleCount: number
  invoice: Invoice | null
}
type SessionRow = {
  id: string
  closed_at: string | null
  closing_amount: number | null
  closed_by: { full_name: string } | null
  fiscal_invoices: Invoice | null
}

export function createBillingQuery(values: BillingValues) {
  if (!BILLING_STATUSES.some((status) => status.value === values.status))
    throw new Error('Selecciona un estado válido.')
  const range =
    values.start || values.end
      ? reportRange('custom', new Date(), values.start, values.end)
      : null
  if ((values.start || values.end) && !range)
    throw new Error(
      'Completa ambas fechas y verifica que Desde no sea posterior a Hasta.',
    )
  return { values: { ...values }, range, page: 0 }
}
export type BillingQuery = ReturnType<typeof createBillingQuery>

export function billingDate(value: string) {
  if (!value) return 'Fecha no disponible'
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function withSales(rows: SessionRow[]): Promise<BillableSession[]> {
  if (!rows.length) return []
  const sales = await readAllPages((from, to) =>
    supabase
      .from('sales')
      .select('id, cash_session_id, total', { count: 'exact' })
      .in(
        'cash_session_id',
        rows.map((row) => row.id),
      )
      .eq('status', 'completed')
      .order('id')
      .range(from, to),
  )
  const totals = new Map<string, { cents: number; count: number }>()
  for (const sale of sales) {
    if (!Number.isFinite(sale.total))
      throw new Error('Hay una venta con importe no disponible.')
    const current = totals.get(sale.cash_session_id) ?? { cents: 0, count: 0 }
    current.cents += Math.round(sale.total * 100)
    if (!Number.isSafeInteger(current.cents))
      throw new Error('El total supera el rango admitido.')
    current.count++
    totals.set(sale.cash_session_id, current)
  }
  return rows.map((row) => ({
    cashSessionId: row.id,
    closedAt: row.closed_at ?? '',
    closedBy: row.closed_by?.full_name ?? 'Usuario no disponible',
    cashCounted: row.closing_amount,
    salesTotal: (totals.get(row.id)?.cents ?? 0) / 100,
    saleCount: totals.get(row.id)?.count ?? 0,
    invoice: row.fiscal_invoices,
  }))
}

export async function loadBillableSessions(query: BillingQuery) {
  const read = async (page: number) => {
    let request = supabase
      .from('cash_sessions')
      .select(SESSION_COLUMNS, { count: 'exact' })
      .eq('status', 'closed')
    if (query.range)
      request = request
        .gte('closed_at', query.range.from)
        .lt('closed_at', query.range.to)
    if (query.values.status === 'none')
      request = request.is('fiscal_invoices', null)
    else if (query.values.status !== 'all')
      request = request
        .not('fiscal_invoices', 'is', null)
        .eq('fiscal_invoices.status', query.values.status)
    const { data, error, count } = await request
      .order('closed_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * BILLING_PAGE_SIZE, (page + 1) * BILLING_PAGE_SIZE - 1)
    if (error) throw error
    if (data === null || count === null)
      throw new Error('Respuesta incompleta de cortes')
    return { data, count }
  }
  let page = query.page
  let result = await read(page)
  const lastPage = Math.max(0, Math.ceil(result.count / BILLING_PAGE_SIZE) - 1)
  if (page > lastPage) {
    page = lastPage
    result = await read(page)
  }
  return {
    rows: await withSales(result.data),
    count: result.count,
    page,
    query,
  }
}
export type BillingResult = Awaited<ReturnType<typeof loadBillableSessions>>

export async function loadBillableSession(id: string) {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .eq('status', 'closed')
    .single()
  if (error) throw error
  if (!data) throw new Error('Corte no encontrado')
  return (await withSales([data]))[0]
}

async function findInvoice(sessionId: string) {
  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select(INVOICE_COLUMNS)
    .eq('cash_session_id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Reconcilia reintentos con la solicitud única del corte antes de volver a escribir. */
export async function requestBillingInvoice(
  sessionId: string,
): Promise<Invoice> {
  const previous = await findInvoice(sessionId)
  if (previous) return previous
  const { error } = await supabase.rpc('request_global_invoice', {
    p_cash_session_id: sessionId,
  })
  // También verifica una respuesta incierta: la transacción pudo completarse.
  const saved = await findInvoice(sessionId)
  if (saved) return saved
  if (error) throw error
  throw new Error(
    'La solicitud se registró, pero no se pudo consultar. Actualiza el detalle antes de continuar.',
  )
}
