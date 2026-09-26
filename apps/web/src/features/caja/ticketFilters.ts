import { reportRange } from '@/lib/dateRange'
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
  const hex = folio.trim().toLowerCase().replaceAll('-', '')
  if (hex && !/^[0-9a-f]{4,32}$/.test(hex))
    throw new Error(
      'Escribe al menos 4 caracteres del folio (letras de A a F y números).',
    )
  const uuid = (text: string) =>
    text.slice(0, 8) +
    '-' +
    text.slice(8, 12) +
    '-' +
    text.slice(12, 16) +
    '-' +
    text.slice(16, 20) +
    '-' +
    text.slice(20)
  return {
    ...range,
    total,
    lowerId: hex ? uuid(hex.padEnd(32, '0')) : null,
    upperId: hex ? uuid(hex.padEnd(32, 'f')) : null,
  }
}
