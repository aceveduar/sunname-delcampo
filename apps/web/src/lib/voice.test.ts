import { describe, expect, it } from 'vitest'
import { parseVoiceCommand, rankVoiceCandidates, voiceMatchScore } from './voice'

describe('parseVoiceCommand', () => {
  it('reconoce un monto en dígitos con verbo de acción', () => {
    expect(parseVoiceCommand('agrega diez pesos de chile guajillo')).toEqual({
      kind: 'amount',
      amountMxn: 10,
      productQuery: 'chile guajillo',
    })
  })

  it('reconoce un monto sin verbo de acción ni palabra de activación', () => {
    expect(parseVoiceCommand('50 pesos de chile serrano')).toEqual({
      kind: 'amount',
      amountMxn: 50,
      productQuery: 'chile serrano',
    })
  })

  it('quita la palabra de activación "caja" del inicio', () => {
    expect(parseVoiceCommand('caja agrega veinte pesos de ajo')).toEqual({
      kind: 'amount',
      amountMxn: 20,
      productQuery: 'ajo',
    })
  })

  it('reconoce números hablados compuestos ("treinta y cinco")', () => {
    expect(parseVoiceCommand('agrega treinta y cinco pesos de comino')).toEqual({
      kind: 'amount',
      amountMxn: 35,
      productQuery: 'comino',
    })
  })

  it('reconoce "cien" como 100', () => {
    expect(parseVoiceCommand('cien pesos de frijol pinto')).toEqual({
      kind: 'amount',
      amountMxn: 100,
      productQuery: 'frijol pinto',
    })
  })

  it('un número sin la palabra "pesos" se toma como cantidad de piezas', () => {
    expect(parseVoiceCommand('agrega dos chocolates abuelita')).toEqual({
      kind: 'quantity',
      quantity: 2,
      productQuery: 'chocolates abuelita',
    })
  })

  it('reconoce la unidad explícita "piezas"', () => {
    expect(parseVoiceCommand('pon tres piezas de piloncillo')).toEqual({
      kind: 'quantity',
      quantity: 3,
      productQuery: 'piloncillo',
    })
  })

  it('sin ningún número, regresa el texto tal cual para buscar por nombre', () => {
    expect(parseVoiceCommand('agrega chile guajillo')).toEqual({
      kind: 'plain',
      productQuery: 'chile guajillo',
    })
  })

  it('ignora acentos y mayúsculas', () => {
    expect(parseVoiceCommand('Agrega DIEZ Pesos De Cúrcuma')).toEqual({
      kind: 'amount',
      amountMxn: 10,
      productQuery: 'curcuma',
    })
  })

  it('regresa null si tras quitar muletillas no queda nada', () => {
    expect(parseVoiceCommand('caja')).toBeNull()
    expect(parseVoiceCommand('')).toBeNull()
    expect(parseVoiceCommand('agrega diez pesos de')).toBeNull()
  })
})

describe('voiceMatchScore', () => {
  it('da 1 cuando el nombre completo contiene el texto reconocido', () => {
    expect(voiceMatchScore('chile guajillo', 'Chile Guajillo Herradura')).toBe(1)
  })

  it('tolera un error chico de reconocimiento de voz (guajio vs guajillo)', () => {
    expect(voiceMatchScore('chile guajio', 'Chile Guajillo Herradura')).toBeGreaterThan(0.5)
  })

  it('da 0 contra un producto sin relación', () => {
    expect(voiceMatchScore('chile guajillo', 'Papel De Estraza')).toBe(0)
  })
})

describe('rankVoiceCandidates', () => {
  const products = [
    { id: '1', name: 'Chile Guajillo Herradura' },
    { id: '2', name: 'Chile Ancho' },
    { id: '3', name: 'Chile Piquín Entero' },
  ]

  it('pone primero la coincidencia más fuerte', () => {
    const ranked = rankVoiceCandidates('chile guajillo', products, (p) => p.name)
    expect(ranked[0].item.name).toBe('Chile Guajillo Herradura')
  })

  it('no incluye productos sin ninguna coincidencia', () => {
    const withUnrelated = [...products, { id: '4', name: 'Papel De Estraza' }]
    const ranked = rankVoiceCandidates('chile guajillo', withUnrelated, (p) => p.name)
    expect(ranked.some((c) => c.item.name === 'Papel De Estraza')).toBe(false)
  })
})
