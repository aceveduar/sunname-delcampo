import { expect, it } from 'vitest'
import { ticketDates, ticketFilters } from './ticketFilters'
it('filtra prefijos de folio con rango UUID e incluye el último día', () => {
  const filters = ticketFilters('2026-09-01', '2026-09-25', '10.10', 'Ab12cD34')
  expect(filters.total).toBe(10.1)
  expect(filters.lowerId).toBe('ab12cd34-0000-0000-0000-000000000000')
  expect(filters.upperId).toBe('ab12cd34-ffff-ffff-ffff-ffffffffffff')
  expect(new Date(filters.to).getDate()).toBe(26)
})
it('calcula días locales completos al cruzar mes y año, incluido febrero bisiesto', () => {
  const now = new Date(2026, 0, 1, 0, 30)
  expect(ticketDates('yesterday', now)).toEqual({
    start: '2025-12-31',
    end: '2025-12-31',
  })
  expect(ticketDates('week', now)).toEqual({
    start: '2025-12-26',
    end: '2026-01-01',
  })
  expect(ticketDates('today', now)).toEqual({
    start: '2026-01-01',
    end: '2026-01-01',
  })
  expect(now.getDate()).toBe(1)
  const dates = ticketDates('yesterday', new Date(2024, 2, 1, 23, 59))
  expect(dates).toEqual({ start: '2024-02-29', end: '2024-02-29' })
  const range = ticketFilters(dates.start, dates.end, '', '', 'voided')
  expect(new Date(range.from)).toEqual(new Date(2024, 1, 29))
  expect(new Date(range.to)).toEqual(new Date(2024, 2, 1))
  expect(range.status).toBe('voided')
})
it('rechaza fechas, importes y folios inválidos', () => {
  expect(() => ticketFilters('2026-09-25', '2026-09-01', '', '')).toThrow()
  for (const amount of ['-1', 'NaN', '12.341'])
    expect(() =>
      ticketFilters('2026-09-01', '2026-09-25', amount, ''),
    ).toThrow()
  for (const folio of ['123', 'zzzz', 'abcd%'])
    expect(() => ticketFilters('2026-09-01', '2026-09-25', '', folio)).toThrow()
})
