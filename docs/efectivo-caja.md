# Entradas y salidas de efectivo

En Caja, el resumen muestra fondo inicial, ventas en efectivo, entradas, salidas y saldo esperado. Se actualiza al confirmar una venta o movimiento, al volver a la ventana y con el botón Actualizar. No es una suscripción en tiempo real: las operaciones del servidor siempre vuelven a validar el saldo.

Entrada / salida permite registrar importe positivo con dos decimales y motivo obligatorio. El historial conserva fecha, motivo y nombre del responsable al registrar. Una salida no puede superar el efectivo esperado. El cierre y el reporte de cortes incluyen estos movimientos, sin contarlos como ventas ni alterar inventario.

Los movimientos son inmutables para usuarios de la aplicación. Para corregir un error, registra el movimiento contrario con un motivo que identifique el original. Los cajeros solo registran en su propia caja abierta; owner/local_admin pueden hacerlo en cualquier caja abierta. Los roles operativos pueden consultar el historial, en línea con la visibilidad compartida de cajas existente.

## Conexión e integridad

- El navegador guarda el UUID y los datos antes de enviar. Un resultado incierto se reintenta con el mismo UUID; recargar la misma pestaña conserva la solicitud, separada por proyecto, usuario y caja.
- Mientras el resultado sea incierto no se editan los datos ni se cierra la caja desde esa pantalla. No se debe mover efectivo físicamente otra vez al reintentar.
- El borrador vive en sessionStorage: cerrar la pestaña o borrar su almacenamiento elimina la recuperación local. En ese caso, revisar el historial antes de volver a registrar un movimiento.
- La RPC deduplica solicitudes y usa el mismo bloqueo de fila que ventas y cierre. Rechaza importes inválidos, caja cerrada, caja ajena para cajeros y salida superior al saldo. La aplicación no dispone de permisos directos de inserción, edición o borrado de movimientos.

## Publicación

El único proyecto remoto usado es **sunname-delcampo**, ref `pancbbjhhovxjnzyentb`. Dev permanece pausado y sin cambios.

Aplicar `supabase/migrations/20260926090000_cash_movements.sql` después de las migraciones del 25 de septiembre, y registrar su versión en el historial si se ejecuta manualmente. No volver a ejecutar las migraciones ya aplicadas. Regenerar los tipos contra el esquema migrado y verificar CI antes de publicar. La CLI local recibió 403 al intentar consultar Delcampo durante esta implementación; no se aplicaron cambios remotos desde esta sesión.

La nueva migración mantiene las columnas previas de `cash_session_balances` y añade `cash_in` y `cash_out`. El cierre existente consume automáticamente el nuevo saldo, porque lo calcula mediante esa vista. Las pruebas SQL corren en la base efímera de GitHub, nunca contra ventas reales.
