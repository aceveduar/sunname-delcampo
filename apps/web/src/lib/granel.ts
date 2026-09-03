// Misma regla de precio que create_sale (Postgres) aplica del lado del
// servidor: solo se usa aquí para la vista previa en Caja, el cálculo
// que de verdad cobra siempre lo hace el servidor.
const round2 = (value: number) => Math.round(value * 100) / 100

// El quiebre de tarifa es en 1/4 kg (250g), no en 1kg -- confirmado con
// las hojas de precio reales del dueño (2026-09-02): en los 27
// productos revisados, el precio del cuarto es SIEMPRE exacto
// precio_kilo ÷ 4, sin excepción. Eso significa que aplicar la tarifa
// de kilo desde 250g en vez de desde 1kg ya da el precio real del
// cuarto sin necesitar guardar una tarifa aparte -- 0.25 × precio_kilo
// = precio_cuarto siempre, por construcción.
const QUARTER_KG = 0.25

export function granelTotalFromWeightKg(
  weightKg: number,
  pricePerKg: number,
  pricePer100g: number,
): number {
  if (weightKg >= QUARTER_KG) return round2(weightKg * pricePerKg)
  return round2(((weightKg * 1000) / 100) * pricePer100g)
}

export function granelWeightKgFromAmount(
  amount: number,
  pricePerKg: number,
  pricePer100g: number,
): number {
  // Un producto sin precio real (price_per_100g en 0, normal mientras se
  // sigue cargando el catálogo) divide entre cero -- eso da Infinity en
  // JS, y de ahí a NaN en cualquier cálculo posterior. Sin esta guarda,
  // ese Infinity terminaba guardado como cantidad del carrito y, al
  // mandarlo a create_sale, JSON.stringify lo vuelve null silenciosamente
  // (Infinity/NaN no son JSON válido), y la base lo rechazaba con un
  // error de "quantity no puede ser null" que no decía nada del problema
  // real (bug real, 2026-08-31).
  if (pricePer100g <= 0) return 0
  // Mismo quiebre que granelTotalFromWeightKg, pero en pesos: el monto
  // que cuestan exactamente 250g a la tarifa de kilo (0.25 × pricePerKg)
  // es el punto donde cambia qué fórmula usar -- no se puede decidir
  // primero calculando el peso de menudeo y comparando contra 0.25,
  // porque para montos que sí caen en el rango del cuarto/kilo esa
  // cuenta da un peso distinto al real (round-trip inconsistente).
  const quarterAmount = QUARTER_KG * pricePerKg
  const weightKg =
    amount < quarterAmount ? amount / pricePer100g / 10 : amount / pricePerKg
  // create_sale guarda la cantidad como numeric(12,3) -- ajustar aquí a
  // gramos enteros es lo que de verdad se va a pesar y cobrar. Sin esto,
  // el total mostrado en el carrito (calculado con el peso exacto sin
  // redondear) no coincidía con lo que el servidor cobraba sobre el peso
  // ya redondeado, y create_sale rechazaba la venta por completo.
  //
  // Se trunca hacia ABAJO, no al gramo más cercano: si el cliente pide
  // "$100 de piquín", el total nunca debe pasarse de esos $100. Con
  // redondeo al más cercano, 166.67g subía a 167g y el total se iba a
  // $100.20 -- el cliente daba sus $100 exactos y el sistema pedía $0.20
  // más, bloqueando la venta (bug real reportado en producción,
  // 2026-09-03). Truncando queda en 166g = $99.60: nunca por encima de
  // lo que pidió, la diferencia se le regresa como cambio.
  if (!Number.isFinite(weightKg)) return 0
  // El épsilon corrige residuo de punto flotante (ej. 249.99999999997
  // debe ser 250g, no 249g) sin llegar a subir un gramo de verdad.
  return Math.floor(weightKg * 1000 + 1e-6) / 1000
}
