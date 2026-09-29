# Recepciones parciales y actualizaciones

Compras permite capturar lo recibido por renglón y deja el resto pendiente. Cada entrega conserva fecha, responsable, nota y cantidades. El historial guarda nombres y costos al recibir. Las compras anteriores inicializan su acumulado sin inventar entregas históricas.

La RPC bloquea la orden, valida permisos y remanentes, y confirma inventario, costos, acumulados e historial en una transacción. UUID persistido por usuario/proyecto/orden evita duplicar una entrega al reintentar después de un fallo de conexión o recargar la misma pestaña. Al cerrar la pestaña o borrar almacenamiento se pierde el borrador: consultar el historial antes de volver a capturar. El endpoint anterior recibe solo el remanente.

Cada compilación publica version.json. La app consulta al iniciar, cada minuto visible y al recuperar foco/conexión. La recarga es manual y se bloquea con carrito, borradores pendientes, escrituras HTTP, formularios o diálogos abiertos. Esta protección funciona para publicaciones posteriores una vez cargada esta versión.

## Publicación

Aplicar supabase/migrations/20260926120000_partial_purchase_receipts.sql en sunname-delcampo (pancbbjhhovxjnzyentb). Registrar la versión si se ejecuta SQL manualmente, comparar los tipos y verificar CI. Dev no se modifica. Las pruebas SQL usan una base temporal en GitHub.
