import { describe, expect, it } from 'vitest'
import { empaqueDesdeTicket, nombreDesdeTicket, toTitleCase } from './text'

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

// El negocio compra por bulto y vende por kilo, así que saber cuánto trae
// el bulto es la diferencia entre un costo correcto y uno 25 veces inflado.
describe('empaqueDesdeTicket', () => {
  it('lee el tamaño anotado como C/25 KG', () => {
    expect(empaqueDesdeTicket('ARROZ SAMAN C/25 KG')).toBe(25)
  })

  it('lee el tamaño anotado con guion y sin espacios', () => {
    expect(empaqueDesdeTicket('AZUCAR C-50KG')).toBe(50)
  })

  it('lee un tamaño suelto al final', () => {
    expect(empaqueDesdeTicket('ACEITE VEGETAL 20 LT')).toBe(20)
  })

  it('no inventa un tamaño cuando el ticket no lo dice', () => {
    expect(empaqueDesdeTicket('CHILE GUAJILLO ROJO')).toBeNull()
  })

  it('no confunde un tamaño en mililitros con un empaque de kilos', () => {
    // 180ML es la presentación de una pieza, no cuántas piezas trae.
    expect(empaqueDesdeTicket('ACEITE DE OLIVO EL OLIVO 180ML')).toBeNull()
  })
})
