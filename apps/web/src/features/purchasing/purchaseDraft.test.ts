import { expect, it } from 'vitest'
import { seedPurchaseLines, validPurchaseLine } from './purchaseDraft'
it('no inventa el costo de una reposición y requiere cantidades e importes válidos', () => {
  const [line] = seedPurchaseLines([{ productId: 'p1', quantity: 2.5 }])
  expect(line.unitCost).toBe('')
  expect(validPurchaseLine(line)).toBe(false)
  expect(validPurchaseLine({ ...line, unitCost: '0' })).toBe(true)
  for (const quantity of ['', '0', '-1', 'NaN', 'Infinity'])
    expect(validPurchaseLine({ ...line, unitCost: '20', quantity })).toBe(false)
})
