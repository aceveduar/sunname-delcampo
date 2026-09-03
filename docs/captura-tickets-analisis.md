# Análisis de tickets reales de central de abastos (Fase 0)

> Punto de partida para el flujo de captura de compras por foto (CLAUDE.md §14.1). Este documento **no propone la solución todavía** — describe qué traen los tickets reales, para diseñar sobre evidencia y no sobre suposiciones. Basado en 11 fotos reales entregadas por el usuario el 2026-09-03 (`tikets/`), de compras hechas entre el 22/08 y el 03/09 de 2026.

## 1. Quiénes son los proveedores

El identificador confiable es el **RFC**, no el nombre ni el logo: un mismo RFC apareció con dos sellos distintos ("El Tamaleño Prado" y "El Xalapeño Pagado"), y dos negocios con nombre parecido resultaron tener RFC distinto.

| Proveedor | RFC | Régimen | Documentos vistos |
|---|---|---|---|
| **La Herradura** (bodegas D423-D424, Venta de Carpio, Ecatepec CP 55060, tel 55 50 71 85 33) | `CGH250408P46` | 601 | 6 tickets impresos + **1 nota manuscrita** |
| **Carlos Ramón Medina Reina** (sellos "El Tamaleño Prado" / "El Xalapeño Pagado"; Ceda Nave A local 5 y Nave D bod. 410) | `MERC780529VE4` | — | 3 tickets impresos |
| **El Tamaleño** (Ceda Ecatepec D421; persona física con actividad empresarial) | `TEAC790521788` | 612 | 1 ticket impreso |

En todos, el cliente aparece como **"DEL CAMPO"**.

## 2. Qué trae un ticket impreso

Estructura común (el orden y las etiquetas cambian entre proveedores, la información no):

- **Encabezado**: nombre, RFC, domicilio, teléfono, régimen fiscal.
- **Identificación**: cliente, fecha, hora, folio y/o pedido, caja, **nombre del vendedor** (Paulino, Ruthea, Cecilia, Mago, Arlsa, Griselda…).
- **Secciones**: `== MAYOREO ==` y/o `== MENUDEO ==`. Un mismo ticket puede traer las dos.
- **Renglones**: nombre del producto, **código interno** (solo La Herradura, ej. `00882`), cantidad, unidad, precio unitario, importe.
- **Pie**: número de artículos, subtotal s/IVA, I.E.P.S., I.V.A., **total**, efectivo recibido, cambio, y la leyenda `** ORIGINAL **` o `** COPIA **`.

**Unidades observadas**: `KG`, `BULTO`, `PZA`, `EMPAQUE`.

**Presentación embebida en el nombre**: `ARROZ SAMAN C/25 KG`, `AJO SIN SAL C/10 KG`, `ACHIOTE LA ANITA 50/110 GRS`, `ARANDANO C/11.34 KG`, `MOLE CHIO ALMENDRADO (C-5 POLVO)`, `ACEITE DE OLIVO 180ML (C-45PZ)`. **Esto importa para el costo**: un bulto de arroz a $412.50 con `C/25 KG` significa $16.50/kg, no $412.50/kg. Sin convertir, el costo quedaría 25 veces mal.

## 3. La propiedad más útil: los tickets se auto-verifican

En **los 8 tickets impresos que pude leer completos, la aritmética cuadró al centavo**, por dos caminos independientes:

1. `cantidad × precio_unitario = importe` en cada renglón.
2. `suma de importes = TOTAL` impreso.

Esto sirve para dos cosas en la extracción automática:

- **Auto-validación**: si lo extraído no cuadra, algo se leyó mal y hay que marcarlo para revisión humana en vez de guardarlo.
- **Recuperación de campos tapados**: si el círculo de pluma tapa la cantidad, se deduce con `importe ÷ precio_unitario`. Así recuperé varios renglones de los tickets del 29/08 y 22/08.

## 4. Lo que va a complicar la extracción (todo esto es real, no hipotético)

1. **Marcas de pluma encima del texto impreso.** El dueño circula los productos conforme los revisa, y los círculos **tapan cantidades y precios**. Es el problema más frecuente: aparece en la mayoría de los tickets.
2. **Raya de marcatextos rojo** atravesando el ticket completo (1 caso).
3. **Sellos de goma** ("ENTREGADO", "PAGADO") encimados sobre el encabezado, a veces cubriendo el RFC.
4. **Notas manuscritas sin desglose.** La `NOTA DE REMISIÓN` folio 1739 trae un solo renglón escrito a mano (`5.74 KG · Huevo(?) · $29 · $166.46`) y ya. **Es del mismo proveedor que da tickets impresos** — o sea que el formato no depende del proveedor, depende del día.
5. **Dos documentos en una sola foto** (1 caso): el ticket impreso encima de la nota manuscrita.
6. **Papel arrugado, doblado, fotografiado en ángulo y rotado 90°** — todas las fotos vinieron acostadas.
7. **I.E.P.S. en algunos tickets** (ej. $30.84 sobre botanas). Los importes por renglón ya lo incluyen; el subtotal impreso es el total menos el impuesto.
8. **Los nombres no coinciden con el catálogo.** Ejemplos reales: el ticket dice `MOLE CHIO ALMENDRADO (C-5 POLVO)` y el catálogo tiene `Mole Almendra en Polvo, Marca Chío`; el ticket dice `CHILE PULLA HERRADURA` y el catálogo `Chile Puya`. Va a hacer falta emparejamiento aproximado + la opción de crear producto nuevo.

## 5. Volumen real

De los tickets vistos: entre **1 y 11 renglones** por documento, y de **$108 a $4,608** por compra. En un mismo día puede haber varios documentos de proveedores distintos (el 03/09 hubo 2, el 22/08 hubo 3). El dueño se surte 1-2 veces por semana.

## 6. Qué implica esto para el diseño (sin decidir nada todavía)

- **La revisión humana no es opcional.** Con marcas de pluma encima de los números, ninguna extracción va a ser confiable al 100%. La pantalla de confirmación editable es parte del diseño, no un extra.
- **Vale la pena validar con la aritmética antes de mostrar.** Si los renglones no suman el total impreso, avisarlo en la pantalla de revisión para que el humano mire justo ahí.
- **El RFC es la llave del proveedor**, no el nombre.
- **Hay que resolver la conversión de unidades** (bulto → kg) o los costos quedarán mal por un factor de 10 o 25.
- **Hay que soportar el caso "documento sin desglose"** (la nota manuscrita): quizá capturando solo el total como un gasto, sin renglones.

## 7. Decisiones tomadas (2026-09-03)

1. **Este flujo actualiza solo el costo.** El precio de venta sigue siendo decisión manual del dueño, hasta que exista una regla de margen acordada.
2. **Las fotos las sube el usuario final** (el dueño o un empleado) desde el sistema, no un técnico. La pantalla tiene que ser simple y a prueba de errores.
3. **Proveedor de IA: Gemini**, por tener plan gratuito continuo (no un crédito que se agota) y buena lectura de documentos. La llamada está aislada en una sola función para poder cambiarlo sin tocar el resto.

Sobre el costo: a ~20 fotos al mes (1-2 surtidos por semana × 2-3 documentos), esto cuesta entre **$1 y $6 pesos al mes** incluso con los modelos más caros del mercado. El criterio para elegir modelo **no es el precio, es la precisión** — un costo mal leído se propaga a los márgenes.

## 8. Qué se construyó (Fase 1, primera pieza)

- **`supabase/functions/extract-purchase-ticket/`** — recibe la ruta de una foto en Storage, la lee con Gemini y devuelve los datos estructurados más una verificación aritmética.
- **Bucket `purchase-tickets`** (privado, admin-only) — la foto se conserva ligada a la compra como respaldo para volver al papel cuando un costo no cuadre.

Se empezó por la extracción y no por la pantalla a propósito: lo más incierto del proyecto era si la IA podía leer estos tickets, y convenía averiguarlo antes de construir interfaz encima.

**Dos principios de diseño en el código:**

1. **El modelo no hace cuentas.** Solo transcribe lo que ve. Verificar que los renglones sumen el total, y deducir una cantidad tapada con `importe ÷ precio`, lo hace código determinista. Si se le pidiera al modelo "asegúrate de que cuadre", ajustaría números para lograrlo — un costo inventado que además pasa la validación sería el peor error posible.
2. **Nunca adivinar.** Si un círculo de pluma o un sello tapa un número, se marca `ilegible` y el renglón sale señalado para revisión, en vez de inventar el dato.

## 9. Resultado de la prueba con tickets reales

Se probaron 4 documentos, incluyendo los 3 más difíciles, contra la transcripción verificada a mano del §2-3:

| Documento | Renglones correctos | Números | Total cuadra |
|---|---|---|---|
| La Herradura 03/09 (11 renglones) | 11/11 | todos exactos | ✓ |
| La Herradura 29/08 (círculos de pluma sobre las cantidades) | 5/5 | todos exactos | ✓ |
| La Herradura 24/08 (sellos encima + IEPS) | 3/3 | todos exactos | ✓ |
| Nota manuscrita folio 1739 | 1/1 | exacto | ✓ |

**Leyó las cantidades a través de los círculos de pluma** — no necesitó la recuperación aritmética que se programó como respaldo (0 renglones deducidos). Y **corrigió 4 lecturas humanas**: `FR Negro Importado` (se había omitido el prefijo de frijol), `Piloncillo Chico` (se había leído "Doncillo", que no existe), `Rotini Palmex` (se había leído "Botani") y resolvió el producto que había quedado con duda en la nota manuscrita: era `Huevo`.

También reporta por su cuenta las dificultades que encuentra, lo cual sirve para la pantalla de revisión. Ejemplo real de su salida: *"presenta rayones con pluma azul sobre las cantidades de los productos... la imagen se encuentra rotada 90 grados a la izquierda"*.

### Tres hallazgos operativos

1. **Comprimir la foto es requisito, no mejora.** Con los archivos tal como salen de la cámara (4080×3060, ~3 MB) la función falló con `IDLE_TIMEOUT` y `WORKER_RESOURCE_LIMIT`. Reducidas a 1600px / ~250 KB funcionó sin problema. La app ya tiene `compressImage()` en `apps/web/src/lib/image.ts` (se usa para fotos de producto) — hay que usarla también aquí.
2. **La lista de modelos de respaldo se ocupó desde el primer día.** Ninguna de las 4 lecturas usó el modelo preferido: `gemini-3.8-flash` y `gemini-3.7-flash` respondieron 503 (saturados) y todas cayeron a `gemini-3.5-flash`. Sin ese respaldo no se habría podido probar nada. La respuesta incluye qué modelo contestó, para poder diagnosticar.
3. **El RFC se puede leer mal.** En el ticket que trae el sello encima del encabezado, devolvió `AGC910308P46` en vez de `CGH250408P46`. Esto **invalida la idea de emparejar proveedores automáticamente solo por RFC** (§6): tiene que pasar por confirmación humana, y conviene apoyarse también en el nombre y el teléfono. Dato útil: en la nota manuscrita, que no trae RFC, el modelo sí alcanzó a leer el teléfono del sello — y es el de La Herradura.

## 10. Configuración necesaria

La función necesita el secreto `GEMINI_API_KEY` en el proyecto de Supabase:

```
npx supabase secrets set GEMINI_API_KEY=... --project-ref <ref-del-proyecto>
```

Opcionalmente, `GEMINI_MODELS` (lista separada por comas) sobrescribe qué modelos intentar y en qué orden, sin necesidad de volver a desplegar código. Es la vía de escape cuando Google retire un modelo: los nombres cambian seguido (2.5 se apaga en octubre de 2026, y ya iban en 3.8 al escribir esto).

## 11. Lo que sigue

La pantalla de revisión en Compras: subir foto (comprimiéndola), mostrar el borrador editable con los renglones marcados para revisión resaltados, y al confirmar crear/emparejar el proveedor, la orden de compra y actualizar `products.cost`.

Recordatorio del hueco que se detectó de paso: hoy `receive_purchase_order` registra `unit_cost` en la orden pero **nunca actualiza `products.cost`** — recibir mercancía a precio nuevo no actualiza el costo en Catálogo. Este proyecto es la oportunidad natural de cerrarlo.
