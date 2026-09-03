import { describe, expect, it } from 'vitest'
import { nombreDesdeTicket, toTitleCase } from './text'

// Descripciones reales de los tickets de central de abastos.
describe('nombreDesdeTicket', () => {
  it('quita el tamaño del bulto anotado como C/25 KG', () => {
    expect(nombreDesdeTicket('ARROZ SAMAN C/25 KG')).toBe('Arroz Saman')
  })

  it('quita la clave del proveedor entre paréntesis', () => {
    expect(nombreDesdeTicket('MOLE ALMENDRADO (C-5 POLVO)')).toBe('Mole Almendrado')
  })

  it('quita un tamaño pegado al final', () => {
    expect(nombreDesdeTicket('ACEITE DE OLIVO EL OLIVO 180ML')).toBe('Aceite De Olivo El Olivo')
  })

  it('deja intacto un nombre que ya está limpio', () => {
    expect(nombreDesdeTicket('CHILE GUAJILLO ROJO')).toBe('Chile Guajillo Rojo')
  })

  it('devuelve el original si limpiar se lleva todo, en vez de dejarlo vacío', () => {
    // Sin la guarda, esto quedaría en cadena vacía y el alta crearía un
    // producto sin nombre.
    expect(nombreDesdeTicket('(C-5)')).toBe(toTitleCase('(C-5)'))
  })
})
