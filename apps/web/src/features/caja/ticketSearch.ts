import { supabase } from '@/lib/supabase'
import { ticketFilters, type TicketSearchValues } from './ticketFilters'

export const TICKET_PAGE_SIZE = 20
export type TicketQuery = {
  values: TicketSearchValues
  filters: ReturnType<typeof ticketFilters>
  page: number
}
export function createTicketQuery(values: TicketSearchValues): TicketQuery {
  return {
    values,
    filters: ticketFilters(
      values.start,
      values.end,
      values.amount,
      values.folio,
      values.status,
    ),
    page: 0,
  }
}

export async function loadTickets(query: TicketQuery) {
  const { filters } = query
  const read = async (page: number) => {
    let request = supabase
      .from('sales')
      .select('id, created_at, total, status', { count: 'exact' })
      .gte('created_at', filters.from)
      .lt('created_at', filters.to)
    if (filters.total !== null) request = request.eq('total', filters.total)
    if (filters.status !== 'all') request = request.eq('status', filters.status)
    if (filters.lowerId && filters.upperId)
      request = request.gte('id', filters.lowerId).lte('id', filters.upperId)
    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * TICKET_PAGE_SIZE, (page + 1) * TICKET_PAGE_SIZE - 1)
    if (error) throw error
    if (data === null || count === null)
      throw new Error('Respuesta incompleta de tickets')
    return { rows: data, count }
  }
  let page = query.page
  let result = await read(page)
  const lastPage = Math.max(0, Math.ceil(result.count / TICKET_PAGE_SIZE) - 1)
  if (page > lastPage) {
    page = lastPage
    result = await read(page)
  }
  return { ...result, page, query }
}
export type TicketSearchResult = Awaited<ReturnType<typeof loadTickets>>
