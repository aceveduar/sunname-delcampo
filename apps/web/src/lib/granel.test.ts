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

  // El quiebre real es en 1/4 kg (250g), no en 1kg -- confirmado con las
  // hojas de precio reales del dueño (2026-09-02): el cuarto siempre es
  // exacto precio_kilo ÷ 4, así que aplicar la tarifa de kilo desde 250g
  // ya da ese precio sin necesitar guardarlo aparte.
  it('usa la tarifa de kilo exactamente en 1/4 kg (250g)', () => {
    expect(granelTotalFromWeightKg(0.25, PRICE_PER_KG, PRICE_PER_100G)).toBe(55)
  })

  it('usa la tarifa de menudeo justo por debajo de 1/4 kg', () => {
    expect(granelTotalFromWeightKg(0.249, PRICE_PER_KG, PRICE_PER_100G)).toBe(57.27)
  })

  it('usa la tarifa de kilo, proporcional, entre 1/4 kg y 1kg', () => {
    expect(granelTotalFromWeightKg(0.4, PRICE_PER_KG, PRICE_PER_100G)).toBe(88)
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

  it('usa la tarifa de kilo cuando el monto equivale a 1/4 kg exacto', () => {
    // $55 = 0.25 × $220/kg -> exactamente 250g.
    expect(granelWeightKgFromAmount(55, PRICE_PER_KG, PRICE_PER_100G)).toBe(0.25)
  })

  it('usa la tarifa de menudeo justo por debajo del monto de 1/4 kg', () => {
    // $54 todavía no alcanza los $55 de un cuarto -> tarifa de menudeo.
    // 234.78g se truncan a 234g (hacia abajo, nunca hacia arriba).
    expect(granelWeightKgFromAmount(54, PRICE_PER_KG, PRICE_PER_100G)).toBe(0.234)
  })

  // El peso derivado de un monto se trunca hacia abajo, nunca al gramo
  // más cercano: si el cliente pide "$100 de X" y entrega $100 exactos,
  // el total no puede pasarse de $100 o la venta se bloquea pidiéndole
  // centavos de más (bug real en producción, 2026-09-03).
  it('nunca cobra más que el monto pedido (caso real: $100 de Chile Piquín)', () => {
    // Chile Piquín Entero real: $512/kg, $60/100g.
    const weightKg = granelWeightKgFromAmount(100, 512, 60)
    expect(weightKg).toBe(0.166) // 166.67g truncado a 166g, no 167g
    expect(granelTotalFromWeightKg(weightKg, 512, 60)).toBe(99.6)
  })

  it('nunca cobra más que el monto pedido, también en la tarifa de kilo', () => {
    // $50 de un producto a $160/kg -> 312.5g truncado a 312g.
    const weightKg = granelWeightKgFromAmount(50, 160, 19)
    expect(weightKg).toBe(0.312)
    expect(granelTotalFromWeightKg(weightKg, 160, 19)).toBeLessThanOrEqual(50)
  })

  it('regresión: nunca produce Infinity/NaN cuando el producto no tiene precio', () => {
    // price_per_100g en 0 es un estado real (producto todavía sin
    // cotizar) -- dividir un monto entre 0 da Infinity en JS, y de ahí
    // NaN en el total. Infinity/NaN no son JSON válido: al mandarlos a
    // create_sale se volvían null en silencio y la base rechazaba la
    // venta con un error que no explicaba nada del problema real
    // (bug real, 2026-08-31).
    const weightKg = granelWeightKgFromAmount(50, 0, 0)
    expect(weightKg).toBe(0)
    expect(Number.isFinite(weightKg)).toBe(true)
    expect(granelTotalFromWeightKg(weightKg, 0, 0)).toBe(0)
  })
})
