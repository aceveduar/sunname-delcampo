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

**Confirmado por el dueño de viva voz (2026-09-03):** "el precio de los 100 gramos aplica cuando el cliente pida menos de 250 gramos, y el precio normal aplica de 250 gramos en adelante". Esta regla se había deducido primero sacando la aritmética de sus hojas de precio (el cuarto siempre daba exacto kilo÷4 en los 27 productos revisados); el dueño después la dijo con sus propias palabras y coincidió exacto. O sea que hoy está confirmada por dos caminos independientes, no es una suposición.

**Aun así, sigue siendo una elección de negocio, no una ley matemática.** Si el dueño algún día cambia de opinión (p. ej. que la tarifa de 100g solo aplique hasta 100g exactos, o que el cuarto deje de ser exacto kilo÷4), **hay que rediseñar esta sección**, no solo cambiar un número. Ver §5.

### ¿Por qué el quiebre es "≥ 0.25", no "= 0.25" con una tarifa aparte para todo lo demás?

Porque no hay datos de cómo cobrar cantidades verdaderamente intermedias (ej. 180g, 400g) que **no** sean ni menudeo puro ni un cuarto/kilo exacto. La decisión tomada (confirmada con el dueño, 2026-09-02) fue: todo lo que sea 250g o más se cobra proporcional a la tarifa de kilo — así que 400g cuesta `0.4 × price`, no una mezcla rara de tarifas. Esto premia comprar "al menos un cuarto" con la tarifa más barata, sin necesitar llegar al kilo completo.

## 3. Las dos formas de vender: por peso y por monto

Caja tiene dos pestañas, y **funcionan de manera distinta por dentro**. Esto es lo más importante de entender de este documento.

### Por peso — "dame 300 gramos"

El cajero escribe los gramos. El precio sale de **peso × tarifa** (la del §2, según si llega o no a 250g). El total es el que resulte: 300g de un chile a $160/kg = $48.00.

### Por monto — "dame $50 de chile"

El cajero escribe los pesos. **El total es exactamente ese monto** ($50.00, ni un centavo más ni menos) y el **peso es el derivado**: el servidor calcula cuántos gramos corresponden y ese número es el que el cajero pesa en la báscula.

Regla confirmada con el dueño (2026-09-03): si el cliente pide $50 y paga con $50, no hay cambio; si paga con $100, el cambio son $50 exactos.

**La tarifa se elige por el monto, no por el peso**, usando el equivalente en dinero del quiebre: `0.25 × price` es lo que cuesta un cuarto a precio de kilo.

```
monto <  0.25 × price  →  peso = monto / price_per_100g / 10   (tarifa de 100g)
monto ≥  0.25 × price  →  peso = monto / price                 (tarifa de kilo)
```

Esto significa que **los gramos que dan por peso NO son proporcionales al dinero**, porque al cruzar el umbral cambia la tarifa. Ejemplo real con Chile Puya ($19/100g, $160/kg → umbral en $40):

| Piden | Gramos | Tarifa | $/kg efectivo |
|---|---|---|---|
| $10 | 53 g | 100g | $188.68 |
| $39 | 205 g | 100g | $190.24 |
| **$40** | **250 g** | **kilo** | **$160.00** |
| $50 | 313 g | kilo | $159.74 |
| $100 | 625 g | kilo | $160.00 |

Con $10 dan 53g; con $50 dan 313g — no 265g, que sería lo proporcional. Los 48g de diferencia son el descuento por haber alcanzado la tarifa de kilo. Y hay un salto notable en el umbral: **$39 dan 205g pero $40 dan 250g**.

Ojo con productos caros: el umbral es en dinero, así que sube con el precio. En Chile Piquín ($60/100g, $512/kg) el umbral está en **$128**, o sea que pedir "$100 de piquín" todavía se cobra a tarifa de menudeo (167g).

## 4. Dónde vive esta lógica

| Dónde | Qué hace | Archivo |
|---|---|---|
| **Servidor** (lo que de verdad se cobra y se guarda) | Bloque `if v_sold_by_weight ...` dentro de `create_sale()`, con las dos ramas: por monto (`v_amount is not null`) y por peso | `supabase/migrations/20260903120000_create_sale_venta_por_monto.sql` (última versión de la función) |
| **Cliente** (solo lo que se ve antes de cobrar) | `granelTotalFromWeightKg()` (total por peso) y `granelWeightKgFromAmount()` (cuántos gramos pesar, por monto) | `apps/web/src/lib/granel.ts` |

**Cuidado con la venta por peso: la regla está duplicada en las dos capas.** El cliente calcula el total para mostrarlo en el carrito, el servidor lo recalcula al cobrar, y **si no coinciden exacto, `create_sale` rechaza la venta entera**. Ya pasó (2026-09-02): se corrigió el quiebre en el cliente y se olvidó el servidor — cualquier venta entre 250g y 1kg empezó a tronar con "los pagos no coinciden con el subtotal". Si tocas la regla, tócala en los dos lados en el mismo commit.

La venta por monto **no tiene ese riesgo**: el cliente solo manda el monto pedido, y el peso y el precio los decide el servidor. El número de gramos que muestra la pantalla sí debe coincidir con el del servidor (mismo redondeo al gramo más cercano), pero si no coincidiera solo se vería un gramo distinto en pantalla — la venta no se rompe.

**En ninguna de las dos formas el navegador manda un precio.** Manda gramos o manda pesos; la tarifa siempre sale del catálogo, del lado del servidor. Eso es lo que impide que un cajero forje precios (hallazgo de la auditoría de seguridad del 2026-08-20).

Textos de ayuda en pantalla que mencionan el quiebre (actualizar si el número cambia):
- `apps/web/src/features/caja/GranelDialog.tsx` — línea con "(menos de 1/4 kg)"
- `apps/web/src/features/catalog/ProductsTab.tsx` — helper text del campo "Precio de menudeo (100g)"

Pruebas que hay que actualizar si el quiebre cambia:
- `apps/web/src/lib/granel.test.ts` (cliente, Vitest)
- `supabase/tests/database/create_sale_security.sql` (servidor, pgTAP — corre en CI antes de cada deploy; cubre las dos formas de venta)

## 5. Qué hacer si el dueño da una regla distinta

Ejemplo del escenario que motivó este documento: *"el precio de los 100g solo aplica para 100g o menos"*.

Eso significaría que el quiebre de menudeo→kilo ya NO es en 250g, sino en algún otro punto, y que probablemente **sí hace falta una tarifa real para el rango intermedio** (100g–250g, o donde sea el nuevo corte) que hoy no existe como columna. Pasos:

1. **Pedir la regla completa, con números reales** — igual que se hizo el 2026-09-02: pedir una hoja de precios real y verificar aritméticamente (no de oído) si los puntos de precio dados son proporcionales entre sí o no. La regla actual de este documento salió de hacer exactamente esa verificación, no de una suposición.
2. Si aparece un tercer precio real e independiente (no derivable de `price` ni `price_per_100g`), **sí hace falta una columna nueva** (ej. `price_per_quarter`) — eso es una migración de esquema, más grande que un simple ajuste de umbral.
3. Cambiar el umbral (o agregar el nuevo tramo) en **los dos lugares del §4**, en el mismo commit — nunca uno sin el otro.
4. **Acordarse de las dos ramas de `create_sale`**: la de venta por peso y la de venta por monto eligen la tarifa con el mismo umbral pero expresado distinto (gramos en una, pesos en la otra: `0.25 × price`). Cambiar una y no la otra deja el sistema cobrando distinto según por cuál pestaña entró el cajero.
5. Actualizar las pruebas de ambos lados (mismo §4) para que cubran el nuevo comportamiento, no solo el viejo.
6. Actualizar los dos textos de ayuda en pantalla (§4) para que sigan diciendo la verdad.
7. Aplicar la migración a producción y confirmar el pipeline de CI en verde (`migration-check`, `db-tests`, `deploy`) antes de darlo por hecho — un cambio de este tipo ya rompió ventas reales una vez por saltarse este paso.

### Orden seguro para desplegar un cambio de esta regla

Aprendido en la práctica el 2026-09-03: **subir el código primero y aplicar la migración a producción después**. `db-tests` corre las pruebas pgTAP contra una base limpia y desechable, así que valida la migración sin tocar nada real; `migration-check` va a fallar mientras tanto (producción todavía no la tiene) y eso está bien, bloquea el deploy a propósito. Cuando `db-tests` pase, se aplica a producción y se relanza el workflow para destrabar el deploy. Así, si la migración trae un error, se descubre en la base desechable y no en la del negocio.
