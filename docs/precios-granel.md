# Precios de productos a granel (por peso)

> Referencia de cómo está construido HOY el cálculo de precio para productos `sold_by_weight = true` (chiles secos, moles, semillas, etc.). Si el dueño da una regla nueva ("el precio de 100g solo aplica para 100g o menos", "el cuarto ya no es exacto kilo÷4", etc.), este documento dice exactamente qué archivos tocar.

## 1. Los datos que se guardan por producto

Cada producto a granel tiene **dos** precios guardados en la base de datos (tabla `products`):

| Columna | Qué es |
|---|---|
| `price` | Precio por **kilo completo** (1000g o más) |
| `price_per_100g` | Tarifa de **menudeo**, por cada 100g, para cantidades chicas |

**No existe una columna para "precio del cuarto".** No hace falta: se confirmó con las hojas de precio reales del dueño (21 de agosto de 2026, Chiles Secos + Moles, 27 productos revisados sin excepción) que el precio de 1/4 kg es **siempre** exacto `price ÷ 4`. Ver `docs/investigacion-cfdi.md`-style de investigación — esta confirmación específica está en el historial de conversación del 2026-09-02, no en un doc aparte todavía.

## 2. La regla de negocio (el quiebre de tarifa)

```
peso < 250g   (1/4 kg) →  tarifa de menudeo, proporcional a price_per_100g
peso ≥ 250g              →  tarifa de kilo, proporcional a price
```

Como el cuarto es exacto `price ÷ 4`, aplicar la tarifa de kilo desde 250g (en vez de desde 1kg, que era el comportamiento original) ya da automáticamente el precio real del cuarto sin necesitar una tarifa aparte:

```
0.25 kg × price = price ÷ 4 = precio real del cuarto (por construcción matemática)
```

**Importante — esto es una elección de diseño, no una ley matemática inevitable.** Si el dueño algún día dice que la tarifa de 100g solo debe aplicar hasta 100g exactos (no hasta 250g), o que el cuarto NO siempre es exacto kilo÷4, **hay que rediseñar esta sección**, no solo cambiar un número. Ver §5.

### ¿Por qué el quiebre es "≥ 0.25", no "= 0.25" con una tarifa aparte para todo lo demás?

Porque no hay datos de cómo cobrar cantidades verdaderamente intermedias (ej. 180g, 400g) que **no** sean ni menudeo puro ni un cuarto/kilo exacto. La decisión tomada (confirmada con el dueño, 2026-09-02) fue: todo lo que sea 250g o más se cobra proporcional a la tarifa de kilo — así que 400g cuesta `0.4 × price`, no una mezcla rara de tarifas. Esto premia comprar "al menos un cuarto" con la tarifa más barata, sin necesitar llegar al kilo completo.

## 3. Dónde vive esta lógica (hay que tocar LAS DOS)

Existen **dos implementaciones independientes** de la misma regla — una da la vista previa en pantalla, la otra es la que de verdad cobra. **Si se cambia una sin la otra, las ventas empiezan a fallar** (el servidor rechaza el cobro si no coincide exacto con lo que él mismo calculó). Esto ya pasó una vez (2026-09-02): se corrigió el cliente, se le olvidó al servidor, y cualquier venta entre 250g y 1kg empezó a tronar con "los pagos no coinciden con el subtotal".

| Dónde | Qué hace | Archivo |
|---|---|---|
| **Cliente** (solo vista previa, lo que ve el cajero en el carrito antes de cobrar) | `granelTotalFromWeightKg()` / `granelWeightKgFromAmount()` | `apps/web/src/lib/granel.ts` |
| **Servidor** (el cálculo que de verdad se cobra y se guarda) | Bloque `if v_sold_by_weight then ...` dentro de `create_sale()` | `supabase/migrations/20260902130000_granel_quarter_threshold.sql` (última versión de la función) |

Textos de ayuda en pantalla que mencionan el quiebre (actualizar si el número cambia):
- `apps/web/src/features/caja/GranelDialog.tsx` — línea con "(menos de 1/4 kg)"
- `apps/web/src/features/catalog/ProductsTab.tsx` — helper text del campo "Precio de menudeo (100g)"

Pruebas que hay que actualizar si el quiebre cambia:
- `apps/web/src/lib/granel.test.ts` (cliente, Vitest)
- `supabase/tests/database/create_sale_security.sql` (servidor, pgTAP — corre en CI antes de cada deploy)

## 4. Cómo se le pide un cuarto (o cualquier cantidad) a Caja

No hay un botón "por cuarto" — se pide por peso o por monto, y el sistema decide la tarifa solo:

- **Por peso**: escribir los gramos (250 para un cuarto exacto). GranelDialog, pestaña "Por peso".
- **Por monto**: escribir los pesos que pide el cliente (ej. "$50 de chile"). GranelDialog, pestaña "Por monto" — internamente resuelve el peso equivalente usando la misma regla del quiebre.

## 5. Qué hacer si el dueño da una regla distinta

Ejemplo del escenario que motivó este documento: *"el precio de los 100g solo aplica para 100g o menos"*.

Eso significaría que el quiebre de menudeo→kilo ya NO es en 250g, sino en algún otro punto, y que probablemente **sí hace falta una tarifa real para el rango intermedio** (100g–250g, o donde sea el nuevo corte) que hoy no existe como columna. Pasos:

1. **Pedir la regla completa, con números reales** — igual que se hizo el 2026-09-02: pedir una hoja de precios real y verificar aritméticamente (no de oído) si los puntos de precio dados son proporcionales entre sí o no. La regla actual de este documento salió de hacer exactamente esa verificación, no de una suposición.
2. Si aparece un tercer precio real e independiente (no derivable de `price` ni `price_per_100g`), **sí hace falta una columna nueva** (ej. `price_per_quarter`) — eso es una migración de esquema, más grande que un simple ajuste de umbral.
3. Cambiar el umbral (o agregar el nuevo tramo) en **ambos** lugares del §3, en el mismo commit — nunca uno sin el otro.
4. Actualizar las pruebas de ambos lados (mismo §3) para que cubran el nuevo comportamiento, no solo el viejo.
5. Actualizar los dos textos de ayuda en pantalla (§3) para que sigan diciendo la verdad.
6. Aplicar la migración a producción y confirmar el pipeline de CI en verde (`migration-check`, `db-tests`, `deploy`) antes de darlo por hecho — un cambio de este tipo ya rompió ventas reales una vez por saltarse este paso.
