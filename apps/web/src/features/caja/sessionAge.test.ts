import { expect, it } from 'vitest'
import { sessionAge } from './sessionAge'
it('distingue una apertura de ayer aunque hayan pasado pocos minutos', () => {
  const result = sessionAge(
    '2026-10-05T23:50:00',
    new Date('2026-10-06T00:15:00').getTime(),
  )!
  expect(result.elapsed).toBe('25 min')
  expect(result.openedLabel).not.toContain('hoy')
  expect(result.openedLabel).toContain('2026')
})
it('muestra días y horas sin perder la fecha de apertura', () => {
  const result = sessionAge(
    '2026-10-03T10:00:00',
    new Date('2026-10-06T12:30:00').getTime(),
  )!
  expect(result.elapsed).toBe('3 días 2 h')
  expect(result.openedLabel).toMatch(/3.*oct.*2026/)
})
it('maneja el primer minuto, horas de hoy y fechas inválidas', () => {
  const now = new Date('2026-10-06T10:00:00').getTime()
  expect(sessionAge('2026-10-06T10:00:00', now)?.elapsed).toBe('menos de 1 min')
  expect(sessionAge('2026-10-06T08:45:00', now)).toMatchObject({
    elapsed: '1 h 15 min',
    openedLabel: expect.stringContaining('hoy'),
  })
  expect(sessionAge('invalid', now)).toBeNull()
})
