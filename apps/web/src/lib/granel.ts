// Misma regla de precio que create_sale (Postgres) aplica del lado del
// servidor: solo se usa aquí para la vista previa en Caja, el cálculo
// que de verdad cobra siempre lo hace el servidor.
const round2 = (value: number) => Math.round(value * 100) / 100

export function granelTotalFromWeightKg(
  weightKg: number,
  pricePerKg: number,
  pricePer100g: number,
): number {
  if (weightKg >= 1) return round2(weightKg * pricePerKg)
  return round2(((weightKg * 1000) / 100) * pricePer100g)
}

export function granelWeightKgFromAmount(
  amount: number,
  pricePerKg: number,
  pricePer100g: number,
): number {
  const menudeoWeightKg = amount / pricePer100g / 10
  const weightKg = menudeoWeightKg < 1 ? menudeoWeightKg : amount / pricePerKg
  // create_sale guarda la cantidad como numeric(12,3) -- redondear aquí a
  // gramos enteros es lo que de verdad se va a pesar y cobrar. Sin esto,
  // el total mostrado en el carrito (calculado con el peso exacto sin
  // redondear) no coincidía con lo que el servidor cobraba sobre el peso
  // ya redondeado, y create_sale rechazaba la venta por completo.
  return Math.round(weightKg * 1000) / 1000
}
