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

## 7. Pendiente antes de construir

Decisiones que el usuario todavía debe tomar (planteadas el 2026-09-03, sin responder):

1. ¿Este flujo actualiza solo el **costo**, dejando el precio de venta como decisión manual? (recomendación dada: sí, por ahora)
2. Esto requiere infraestructura nueva: una función en el servidor que llame a un modelo con visión — primera integración de IA real del proyecto, con costo por foto y unos segundos de espera.
3. ¿Quién sube las fotos: el dueño desde su celular, o el usuario después?

Y una tarea de investigación pendiente: comparar opciones de IA con plan gratuito (**Grok** de xAI, **Groq** —que es otro proveedor distinto, ojo con el nombre—, y **Gemini**, que históricamente tiene el plan gratuito más generoso con visión). Criterios: soporte real de visión/OCR, límites diarios, calidad con texto en español sobre papel arrugado, y si se puede llamar desde una Edge Function de Supabase.
