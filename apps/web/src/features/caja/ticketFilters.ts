import { localDateValue, reportRange } from '@/lib/dateRange'
import { uuidPrefixRange } from '@/lib/uuidPrefix'

export const ticketStatuses = [
  { value: 'all', label: 'Todas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'voided', label: 'Anuladas' },
] as const
export type TicketStatus = (typeof ticketStatuses)[number]['value']
export type TicketSearchValues = {
  start: string
  end: string
  amount: string
  folio: string
  status: TicketStatus
}
export const ticketDatePresets = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'week', label: 'Últimos 7 días' },
] as const
export type TicketDatePreset = (typeof ticketDatePresets)[number]['value']

/** Días locales completos: evita desplazar fechas por UTC o cambios de horario. */
export function ticketDates(preset: TicketDatePreset, now = new Date()) {
  const start = new Date(now)
  const end = new Date(now)
  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  }
  if (preset === 'week') start.setDate(start.getDate() - 6)
  return { start: localDateValue(start), end: localDateValue(end) }
}

export function initialTicketValues(): TicketSearchValues {
  return { ...ticketDates('today'), amount: '', folio: '', status: 'all' }
}

export function ticketPeriodLabel(
  values: Pick<TicketSearchValues, 'start' | 'end'>,
) {
  const format = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  return values.start === values.end
    ? format(values.start)
    : `${format(values.start)} – ${format(values.end)}`
}

export function ticketFilters(
  start: string,
  end: string,
  amount: string,
  folio: string,
  status: TicketStatus = 'all',
) {
  const range = reportRange('custom', new Date(), start, end)
  if (!range) throw new Error('Selecciona un periodo válido.')
  const total = amount.trim() === '' ? null : Number(amount)
  if (
    total !== null &&
    (!Number.isFinite(total) ||
      total < 0 ||
      total >= 1e10 ||
      Math.abs(Math.round(total * 100) - total * 100) > 1e-6)
  )
    throw new Error('Indica un importe válido con hasta dos decimales.')
  return {
    ...range,
    total,
    status,
    ...uuidPrefixRange(folio),
  }
}
