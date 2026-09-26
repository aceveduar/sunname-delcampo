import { describe, expect, it } from 'vitest'
import {
  needsReplenishment,
  replenishmentQuantity,
  replenishmentCsv,
} from './replenishment'
import type { StockRow } from './useInventoryStock'

describe('Reposición de inventario', () => {
  it('respeta mínimos desactivados e incluye el umbral y existencias negativas', () => {
    expect(needsReplenishment(2, 2)).toBe(true)
    expect(needsReplenishment(-1, 2)).toBe(true)
    expect(needsReplenishment(3, 2)).toBe(false)
    expect(needsReplenishment(-1, 0)).toBe(false)
    expect(replenishmentQuantity(-1.2, 2)).toBe(3.2)
    expect(replenishmentQuantity(3, 2)).toBe(0)
  })
  it('exporta solo productos por reponer, escapa comillas y neutraliza fórmulas', () => {
    const rows = [
      {
        product: { id: '1', name: '=SUM(1)', sku: 'A"B', unit_id: 'kg' },
        quantityOnHand: 0.5,
      },
      {
        product: { id: '2', name: 'Suficiente', unit_id: 'kg' },
        quantityOnHand: 5,
      },
    ] as StockRow[]
    const csv = replenishmentCsv(
      rows,
      new Map([
        ['1', 2],
        ['2', 2],
      ]),
      () => 'kg',
    )
    expect(csv).toContain("'=SUM(1)")
    expect(csv).toContain('A""B')
    expect(csv).toContain('"1.5"')
    expect(csv).not.toContain('Suficiente')
  })
})
