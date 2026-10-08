import { reportRange } from '@/lib/dateRange'
import { uuidPrefixRange } from '@/lib/uuidPrefix'
export function ticketFilters(
  start: string,
  end: string,
  amount: string,
  folio: string,
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
    ...uuidPrefixRange(folio),
  }
}
