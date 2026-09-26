import { expect, it } from 'vitest'
import { ticketFilters } from './ticketFilters'
it('filtra prefijos de folio con rango UUID e incluye el último día', () => {
  const filters = ticketFilters('2026-09-01', '2026-09-25', '10.10', 'Ab12cD34')
  expect(filters.total).toBe(10.1)
  expect(filters.lowerId).toBe('ab12cd34-0000-0000-0000-000000000000')
  expect(filters.upperId).toBe('ab12cd34-ffff-ffff-ffff-ffffffffffff')
  expect(new Date(filters.to).getDate()).toBe(26)
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
