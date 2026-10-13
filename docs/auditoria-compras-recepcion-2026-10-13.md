# Compras y recepción — revisión del 13 de octubre de 2026

## Cambios

- Resumen filtrable de todas las órdenes, por recibir, parciales y recibidas.
  «Por recibir» incluye órdenes sin entregas y parciales; antes su contador
  comparaba un estado inexistente y mostraba cero.
- Búsqueda por palabras del proveedor y folio sin acentos. Filtros conservados en
  la URL; páginas de 25 órdenes y retorno a la primera página al cambiar filtros,
  sin desplazar la pantalla en cada pulsación del buscador.
- Lectura de todas las páginas de órdenes y proveedores, con conteo exacto y
  orden estable. Los fallos conservan la última lista completa.
- Alta manual y por foto bloqueadas mientras las referencias no están
  disponibles. Las recepciones nuevas también se bloquean ante un fallo de la
  lista; verificar una entrega previamente enviada sigue disponible.
- Tarjetas ajustadas al contenido, con unidades en lo pendiente y avance por
  renglones. Se distinguen renglones con alguna entrega y renglones completos;
  no se suman cantidades de unidades distintas.
- Captura y revisión de entregas con acciones fuera del área desplazable. Los
  excesos, cantidades negativas y precisión inválida se explican junto al
  producto, conservando la captura.
- Detalle de orden con título, total y regreso visibles durante el desplazamiento.
- Historial que destaca responsable, fecha, productos y nota. Una consulta
  fallida conserva su página anterior y bloquea navegar hasta recuperarla;
  nunca presenta un fallo como ausencia de entregas.

Se conservan las RPC e identificadores de reintento existentes. No se alteran
cantidades almacenadas, costos, roles ni migraciones. El historial utiliza los
nombres y cantidades guardados en cada entrega; esta entrega no incorpora una
unidad histórica congelada a esos registros.

## Validación

Pruebas de consulta con 501 órdenes y 501 proveedores, fallo en páginas posteriores,
conteos, filtros, paginación, historial fallido/reintentado y validación de entregas.
También se ejecutaron las pruebas existentes de captura de órdenes y recepción
idempotente.

Chrome con API totalmente simulada: 501 órdenes, recepción de 30 renglones e
historial de 11 entregas, a 1366 × 900, 390 × 844 y 360 × 800, modo oscuro y
texto ampliado. Se comprobó el ancho de página y diálogos, posición de las acciones
al desplazar la captura, revisión parcial, historial y recuperación de una
consulta rechazada. Cero escrituras y cero peticiones a servicios reales.

Tipos, lint y paquete de producción aprobados. La CI ejecuta adicionalmente la
suite completa y las comprobaciones de base de datos antes de desplegar.

## Próxima entrega

Auditoría de rendimiento registrada en `prioridades-ux-rendimiento.md`.
Mostrar 25 tarjetas limita el trabajo de renderizado, pero la consulta todavía
recorre el historial para calcular los resúmenes completos. Medir esa carga antes
de decidir agregaciones y filtros en servidor, caché compartida o virtualización.
No se ha certificado todavía el objetivo de rendimiento de toda la aplicación.

Tras un alta confirmada se limpian filtros y se regresa a la primera página;
un fallo conserva el alcance anterior y la captura. Una regresión cubre el alta
desde una búsqueda que solo mostraba una orden.