import { describe, expect, it } from 'vitest'
import { reportRange } from '@/lib/dateRange'

describe('Periodos de reportes', () => {
  it('incluye por completo el último día y respeta la fecha local', () => {
    const range = reportRange('custom', new Date(), '2026-09-01', '2026-09-25')!
    expect(new Date(range.from)).toEqual(new Date(2026, 8, 1))
    expect(new Date(range.to)).toEqual(new Date(2026, 8, 26))
  })
  it('rechaza fechas inexistentes, vacías o invertidas', () => {
    expect(
      reportRange('custom', new Date(), '2026-02-30', '2026-03-01'),
    ).toBeNull()
    expect(reportRange('custom', new Date(), '', '2026-03-01')).toBeNull()
    expect(
      reportRange('custom', new Date(), '2026-09-26', '2026-09-25'),
    ).toBeNull()
  })
  it('actualiza la hora de corte y calcula siete días incluyendo hoy', () => {
    const now = new Date(2026, 8, 25, 13, 30)
    expect(reportRange('today', now)?.to).toBe(now.toISOString())
    expect(reportRange('week', now)?.from).toBe(
      new Date(2026, 8, 19).toISOString(),
    )
    expect(reportRange('month', now)?.from).toBe(
      new Date(2026, 8, 1).toISOString(),
    )
  })
})
