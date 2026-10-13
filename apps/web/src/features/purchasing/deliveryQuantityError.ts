export function deliveryQuantityError(
  value: string,
  remaining: number,
  unit: string,
) {
  if (!value.trim() || Number(value) === 0) return null
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity < 0)
    return 'Ingresa una cantidad positiva.'
  if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) >= 1e-6)
    return 'Usa hasta tres decimales.'
  if (quantity > remaining)
    return (
      'No puede superar lo pendiente: ' +
      remaining +
      (unit ? ' ' + unit : '') +
      '.'
    )
  return null
}
