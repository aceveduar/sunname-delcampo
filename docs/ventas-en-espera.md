# Ventas en espera

En Caja, **Poner en espera** conserva la compra y libera el carrito para atender a otro cliente.
**En espera** permite revisarla, retomarla o descartarla con confirmación.

- Hasta 20 compras por proyecto y usuario en el mismo navegador; no se sincronizan con otros equipos.
- Se conservan productos, cantidades, pesadas por separado, modalidad por monto, cliente y una referencia opcional.
- No se guardan efectivo recibido ni método de pago. No generan ventas, cobros ni movimientos de inventario.
- Persisten al cerrar la caja. Retomarlas requiere una caja abierta y un carrito vacío.
- La revisión consulta catálogo público, existencias y cliente vigentes. Advierte sobre precios, productos omitidos por inactividad/cambio de unidad, cliente no disponible y stock insuficiente.
- Antes de confirmar se repite la consulta. Si cambió el resumen, se pide revisarlo de nuevo.
- Una compra con intento de cobro pendiente no se puede poner en espera: primero debe resolverse su confirmación.

## Integridad local

Los cambios se serializan con Web Locks por proyecto/usuario, también entre pestañas.
Un marcador en sessionStorage y un commit en localStorage permiten resolver una recarga entre las escrituras:
antes del commit se recupera el carrito anterior; después, el destino.
La falta de espacio o un fallo de lectura no deben sobrescribir el respaldo.
Los commits sin referencias pueden quedar tras una interrupción de limpieza; no son compras ni se pueden cobrar.

El almacenamiento contiene solo borradores. Borrar los datos del navegador elimina las compras en espera.
No se requiere migración SQL ni cambios de permisos.

## Validación

Pruebas de almacenamiento, concurrencia, recuperación, carrito ocupado, cobros inciertos, tarifas de granel,
cliente inactivo y disponibilidad. Revisión en Chrome con API simulada, dos pestañas,
1366×768 y 390×844, modo oscuro y texto grande; sin escrituras en el negocio.
