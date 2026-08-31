import { describe, expect, it } from 'vitest'
import { granelTotalFromWeightKg, granelWeightKgFromAmount } from './granel'

// Precios de referencia: Chile Guajillo Herradura real (Del Campo).
const PRICE_PER_KG = 220
const PRICE_PER_100G = 23

describe('granelTotalFromWeightKg', () => {
  it('usa la tarifa de menudeo por debajo de 1kg', () => {
    expect(granelTotalFromWeightKg(0.217, PRICE_PER_KG, PRICE_PER_100G)).toBe(49.91)
  })

  it('usa la tarifa de mayoreo exactamente en 1kg', () => {
    expect(granelTotalFromWeightKg(1, PRICE_PER_KG, PRICE_PER_100G)).toBe(220)
  })

  it('usa la tarifa de mayoreo por encima de 1kg', () => {
    expect(granelTotalFromWeightKg(1.5, PRICE_PER_KG, PRICE_PER_100G)).toBe(330)
  })

  it('redondea a centavos', () => {
    expect(granelTotalFromWeightKg(0.133, PRICE_PER_KG, PRICE_PER_100G)).toBe(30.59)
  })
})

describe('granelWeightKgFromAmount', () => {
  it('redondea a gramos enteros (regresión: create_sale guarda numeric(12,3))', () => {
    // $50 de chile a $23/100g -> 217.391...g sin redondear; create_sale
    // solo puede guardar gramos enteros, así que el cliente tiene que
    // llegar al mismo número o create_sale rechaza la venta por
    // descuadre entre pago y subtotal (bug real, 2026-08-30).
    const weightKg = granelWeightKgFromAmount(50, PRICE_PER_KG, PRICE_PER_100G)
    expect(weightKg).toBe(0.217)
  })

  it('el total recalculado sobre el peso redondeado es el que de verdad se cobra', () => {
    const weightKg = granelWeightKgFromAmount(50, PRICE_PER_KG, PRICE_PER_100G)
    expect(granelTotalFromWeightKg(weightKg, PRICE_PER_KG, PRICE_PER_100G)).toBe(49.91)
  })

  it('usa la tarifa de mayoreo cuando el monto equivale a 1kg o más', () => {
    // $440 a $220/kg -> exactamente 2kg.
    expect(granelWeightKgFromAmount(440, PRICE_PER_KG, PRICE_PER_100G)).toBe(2)
  })
})
