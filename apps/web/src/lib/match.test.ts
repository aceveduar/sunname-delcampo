import { describe, expect, it } from 'vitest'
import { bestUnambiguous, matchScore, rankCandidates } from './match'

// Nombres reales: los del catálogo de Del Campo contra los que traen los
// tickets del proveedor, que casi nunca coinciden letra por letra.
const CATALOGO = [
  'Chile Puya',
  'Chile Guajillo Herradura',
  'Ajonjolí Moreno',
  'Ajonjolí Blanco',
  'Mole Almendrado',
  'Frijol Pinto',
]

describe('matchScore', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(matchScore('AJONJOLI', 'Ajonjolí Moreno')).toBe(1)
  })

  it('tolera un error chico de transcripción', () => {
    // El ticket dice "PULLA", el catálogo dice "Puya".
    expect(matchScore('CHILE PULLA', 'Chile Puya')).toBeGreaterThan(0.9)
  })

  it('no confunde dos chiles distintos', () => {
    expect(matchScore('CHILE PULLA HERRADURA', 'Chile Guajillo Herradura')).toBeLessThan(0.9)
  })
})

describe('bestUnambiguous', () => {
  it('elige cuando hay un solo candidato claramente mejor', () => {
    const elegido = bestUnambiguous(rankCandidates('CHILE PULLA', CATALOGO, (n) => n), 0.6)
    expect(elegido).toBe('Chile Puya')
  })

  it('no elige cuando dos productos empatan', () => {
    // "AJONJOLI" describe igual de bien al Moreno y al Blanco: preseleccionar
    // uno se vería seguro y estaría mal la mitad de las veces.
    const candidatos = rankCandidates('AJONJOLI', CATALOGO, (n) => n)
    expect(candidatos[0].score).toBe(candidatos[1].score)
    expect(bestUnambiguous(candidatos, 0.6)).toBeNull()
  })

  it('no elige nada cuando el ticket trae algo que no está en el catálogo', () => {
    const candidatos = rankCandidates('ACEITE DE OLIVO EL OLIVO 180ML', CATALOGO, (n) => n)
    expect(bestUnambiguous(candidatos, 0.6)).toBeNull()
  })

  it('no elige cuando el parecido no llega al umbral', () => {
    expect(bestUnambiguous([{ item: 'Frijol Pinto', score: 0.5 }], 0.6)).toBeNull()
  })
})
