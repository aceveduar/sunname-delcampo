# Mejoras de operación — 25 de septiembre de 2026

## Flujos

- Inventario permite configurar mínimos, consultar movimientos por producto y preparar una compra con los productos filtrados que están debajo del mínimo. Se puede desmarcar cada producto y editar cantidad/costo. El costo empieza vacío para no inventar un precio de compra. Crear la orden no recibe mercancía: la recepción sigue en Compras.
- El historial pagina 30 movimientos por consulta y muestra fecha, responsable disponible según permisos, variación, origen, referencia y observación. No modifica movimientos previos.
- Caja permite buscar tickets incluso sin una sesión abierta. Fechas inclusivas, importe exacto y prefijo de folio (mínimo cuatro caracteres) se filtran en servidor; 20 resultados por página. Reportes también puede abrir cada ticket.
- La reimpresión usa cantidad, precio y subtotal almacenados; se identifica como copia y como anulada cuando corresponde. No ejecuta create_sale. No inventa efectivo entregado ni cambio, que no se almacenaban. Las ventas nuevas guardan nombre y modalidad de venta; en ventas antiguas el nombre se inicializa con el catálogo vigente porque no existía ese historial.

## Transacciones

La función close_cash_session bloquea la fila de caja, vuelve a calcular el efectivo esperado y exige que coincida con el resumen confirmado. La observación de descuadre se valida en servidor. Triggers de ventas y pagos toman el mismo bloqueo hasta terminar su transacción. Una venta anterior al cierre se incluye en el balance y una venta posterior se rechaza. Las anulaciones históricas siguen permitidas y conservan el bloqueo durante su actualización.

create_purchase_order guarda cabecera y líneas en una sola transacción. Su UUID y bloqueo transaccional evitan duplicar reintentos simultáneos. El cliente conserva el UUID ante una respuesta incierta mientras permanece montado el flujo; no constituye una cola persistente de compras. Si se recarga tras un resultado incierto, revisar Compras antes de iniciar otra orden.

## Validación

- Pruebas de frontend para filtros, importes históricos, cantidades/costos, reintentos de compras, cierre y funcionalidades anteriores.
- PostgreSQL 17 temporal: ejecución de las migraciones sobre fixtures compatibles y de la función real create_sale. Dos conexiones concurrentes verificaron venta primero/cierre después y cierre primero/venta después. También se verificaron rollback de compra con línea inválida, dos solicitudes simultáneas con el mismo UUID y bloqueo de UPDATE directo de caja.
- Se agregan pruebas pgTAP a supabase/tests/database para que CI compruebe estas reglas contra Supabase completa. Las pruebas de concurrencia locales no sustituyen ese entorno.
- Chrome con backend simulado para selección/edición de reposición, historial, filtros de tickets e impresión sin cobros reales.

## Publicación

1. Resolver el acceso a Supabase: la CLI respondió 403 al consultar el proyecto vinculado con la cuenta actual.
2. Aplicar, en orden, 20260925120000_inventory_minimums_cash_balance.sql y 20260925130000_atomic_cash_and_purchase_orders.sql. Confirmar antes que no existan otras migraciones pendientes.
3. Regenerar apps/web/src/lib/database.types.ts desde el esquema migrado; CI compara su contenido exacto con producción.
4. Ejecutar CI y desplegar la web. Recargar las terminales después: la versión anterior intenta cerrar mediante UPDATE directo, ahora bloqueado en favor del RPC validado. Coordinar este paso con la operación de caja.

No se aplicaron migraciones ni se registraron ventas o compras de prueba en producción.
