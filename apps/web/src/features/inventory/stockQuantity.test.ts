import { expect, it } from 'vitest'
import { parseMovementQuantity, projectedStock } from './stockQuantity'
it('rechaza movimientos vacíos, negativos, cero y fracciones menores a la precisión de inventario', () => {
  for (const value of [
    '',
    ' ',
    '0',
    '-1',
    '0.0009',
    '1.2345',
    'NaN',
    'Infinity',
    '1000000000',
  ])
    expect(parseMovementQuantity(value)).toBeNull()
  expect(parseMovementQuantity('.5')).toBe(0.5)
  expect(parseMovementQuantity('2.')).toBe(2)
  expect(parseMovementQuantity('0.001')).toBe(0.001)
  expect(parseMovementQuantity('5.250')).toBe(5.25)
})
it('calcula sumas y restas en milésimas sin residuos de coma flotante', () => {
  expect(projectedStock(0.1, 0.2)).toBe(0.3)
  expect(projectedStock(0.3, -0.2)).toBe(0.1)
  expect(projectedStock(5.5, -1.125)).toBe(4.375)
  expect(projectedStock(0, -0.001)).toBe(-0.001)
})
