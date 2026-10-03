import { expect, it } from 'vitest'
import { errorMessage } from './errorMessage'
it('lee errores anidados sin convertir objetos en texto genérico', () => {
  expect(
    errorMessage({ error: new Error('No se pudo descargar el módulo') }),
  ).toBe('No se pudo descargar el módulo')
  expect(errorMessage({ message: 'Caja cerrada' })).toBe('Caja cerrada')
  expect(errorMessage({ message: { cause: new Error('Sin conexión') } })).toBe(
    'Sin conexión',
  )
  const cycle: { cause?: unknown } = {}
  cycle.cause = cycle
  expect(errorMessage(cycle)).toBe(
    'Ocurrió un error inesperado. Intenta de nuevo.',
  )
  expect(errorMessage({ message: '[object Object]' })).not.toContain(
    '[object Object]',
  )
})
