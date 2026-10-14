# Prioridades de experiencia y rendimiento

Solicitud del usuario registrada el 13 de octubre de 2026:
«Necesito full rendimiento, necesito un sistema super rápido y bonito».

## Requisito permanente

La velocidad y la claridad visual son criterios de aceptación para las próximas
entregas. Mantener código modular, accesibilidad, legibilidad y consistencia de
precios, inventario y pagos. Las optimizaciones deben conservar los datos correctos
y los borradores de trabajo.

## Pendiente: auditoría de rendimiento completa

Realizar una entrega dedicada después del siguiente pulido de Compras y recepción:

- Medir carga inicial, navegación, búsqueda, desplazamiento de listas y apertura de
  diálogos con catálogos grandes y equipos de prestaciones moderadas.
- Registrar por separado tiempo de interfaz, número de peticiones, datos
  transferidos y duración de las consultas. Fijar presupuestos medibles a partir
  de esa línea base y comprobar la mejora con las mismas condiciones.
- Revisar cargas repetidas de productos, categorías y unidades, tamaño del
  paquete JavaScript, imports de módulos y fotografías.
- Evaluar caché compartida con invalidación correcta, consultas paginadas en
  servidor, miniaturas optimizadas y carga diferida según los resultados.
- Revisar renders y listas antes de añadir virtualización u otras dependencias.
- Mantener interacciones ágiles, feedback inmediato y animaciones breves que
  respeten la preferencia de movimiento reducido.
- Validar escritorio, móvil, texto ampliado y modo oscuro. Usar datos simulados
  para pruebas de volumen y operaciones; no escribir datos de prueba en producción.

No afirmar mejoras de rendimiento sin comparar mediciones antes y después.

## Siguiente revisión de UX/UI

Compras y recepción de mercancía: revisar primero lo existente para completar o
pulir la visibilidad de pendientes y entregas parciales, las cantidades
pedido/recibido/pendiente, el historial de recepciones y las acciones en móvil.
Evitar duplicar funciones ya implementadas.

Después, revisar Inicio para que los pendientes y accesos ayuden a organizar la
operación diaria.

## Seguimiento del 13 de octubre

La revisión de Compras y recepción se completó; alcance y validación en
auditoria-compras-recepcion-2026-10-13.md. La auditoría dedicada de rendimiento
queda como siguiente prioridad. Esta revisión no sustituye las mediciones de
velocidad pendientes.
## Primera optimización medida

Búsqueda de Caja con índice local por versión de catálogo y comparación del
algoritmo anterior/nuevo. Resultados y límites en
rendimiento-busqueda-caja-2026-10-13.md. La medición de carga/navegación, red,
fotografías y renders sigue pendiente; no se considera cerrada la auditoría.