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
  const menudeoWeightKg = (amount / pricePer100g / 10)
  if (menudeoWeightKg < 1) return menudeoWeightKg
  return amount / pricePerKg
}
