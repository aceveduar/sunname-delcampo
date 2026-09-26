export type PurchaseSeedLine = {
  productId: string
  quantity: number
  unitCost?: number
}
export type PurchaseDraftLine = {
  productId: string
  quantity: string
  unitCost: string
  selected: boolean
}
export function seedPurchaseLines(
  lines: PurchaseSeedLine[],
): PurchaseDraftLine[] {
  return lines.map((line) => ({
    productId: line.productId,
    quantity: String(line.quantity),
    unitCost: line.unitCost === undefined ? '' : String(line.unitCost),
    selected: true,
  }))
}
export function validPurchaseLine(line: PurchaseDraftLine) {
  return (
    line.quantity.trim() !== '' &&
    line.unitCost.trim() !== '' &&
    Number.isFinite(Number(line.quantity)) &&
    Number(line.quantity) > 0 &&
    Number(line.quantity) < 1e9 &&
    Number.isFinite(Number(line.unitCost)) &&
    Number(line.unitCost) >= 0 &&
    Number(line.unitCost) < 1e10
  )
}
