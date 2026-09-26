import type { StockRow } from './useInventoryStock'

export function needsReplenishment(quantity: number, minimum: number) {
  return minimum > 0 && quantity <= minimum
}
export function replenishmentQuantity(quantity: number, minimum: number) {
  return Math.max(0, Math.round((minimum - quantity) * 1000) / 1000)
}
// Evita interpretar nombres/SKU como fórmulas al abrir el archivo en una hoja de cálculo.
function csvCell(value: string | number) {
  const text = String(value)
  const safe =
    typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? "'" + text : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
export function replenishmentCsv(
  rows: StockRow[],
  minimums: Map<string, number>,
  unitCode: (id: string) => string,
) {
  const lines: (string | number)[][] = [
    [
      'Producto',
      'SKU',
      'Existencia',
      'Mínimo',
      'Cantidad para alcanzar mínimo',
      'Unidad',
    ],
  ]
  for (const row of rows) {
    const minimum = minimums.get(row.product.id) ?? 0
    if (!needsReplenishment(row.quantityOnHand, minimum)) continue
    lines.push([
      row.product.name,
      row.product.sku ?? '',
      row.quantityOnHand,
      minimum,
      replenishmentQuantity(row.quantityOnHand, minimum),
      unitCode(row.product.unit_id),
    ])
  }
  return (
    '\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n')
  )
}
export function downloadReplenishment(csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'reposicion-inventario.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
