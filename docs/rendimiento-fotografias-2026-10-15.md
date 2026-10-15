# Fotografías: solicitudes próximas a la zona visible

15 de octubre de 2026.

## Hallazgo y comportamiento

Las miniaturas ya usaban loading=lazy, pero el margen interno del navegador
adelantaba imágenes lejanas. DeferredImage conserva tamaño y estilos existentes,
y solo asigna src al acercarse a la zona visible (margen vertical de 160 px).
Usa IntersectionObserver, también sensible al recorte de contenedores con scroll.

Una foto solicitada permanece cargada al salir de vista. Al cambiar la URL se
verifica la nueva fuente y se ignoran callbacks del observador anterior.
Cada observador se desconecta al activarse o desmontarse. Sin soporte del
observador se conserva el src y loading=lazy nativos. decoding=async evita
solicitar decodificación síncrona.

Integrado en resultados de Catálogo, tarjetas de productos de Caja y resultados
de Inventario. Formularios, originales, URLs, tamaños visuales y archivos en
Storage permanecen iguales. No se requiere SQL ni servicio de transformación.

## Medición en navegador

Builds de producción, Chromium headless, contexto nuevo sin caché ni service
workers, sesión administrativa y API interceptadas. Página de Catálogo con
25 productos y 25 URLs distintas de imágenes SVG simuladas. Se esperó 800 ms
tras aparecer las acciones; después se recorrió la página en pasos de 400 px,
con 80 ms entre pasos y 500 ms al terminar.

| Escenario | Solicitudes iniciales antes | Después | Solicitadas al recorrer | Imágenes decodificadas al final |
| --- | ---: | ---: | ---: | ---: |
| 1366 × 900, tabla | 25 | 7 | 25 | 25 |
| 390 × 844, tarjetas, oscuro y texto grande | 15 | 1 | 25 | 25 |

No hubo errores no controlados ni escrituras. Todos los accesos externos fueron
interceptados: ninguna prueba consultó o modificó producción.

Son conteos de solicitudes en estos escenarios, no mediciones de bytes de las
fotografías reales ni de latencia total. El umbral nativo y los resultados pueden
variar por navegador, conexión y altura. Recorrer todo descarga las mismas fotos:
el ahorro consiste en no descargar todavía lo que no se consulta. El tamaño y la
resolución de las fotos existentes no se redujeron.

## Validación

- Pruebas de descarga al acercarse, permanencia de la imagen, dimensiones,
  cambio de fuente, callbacks tardíos y alternativa sin IntersectionObserver.
- Regresiones de directorio, acciones/paginación y tarjetas de Caja.
- Build de producción y lint, sin nuevos avisos.
- Una suite local no inició su trabajador a tiempo; el reintento aislado de
  ProductsTab pasó sus cinco pruebas. Las otras tres suites pasaron siete.

## Pendientes de auditoría

Miniaturas físicas optimizadas para reducir los bytes de cada imagen visible
requieren una estrategia de generación/almacenamiento y verificación de las fotos
existentes. Este cambio no depende de una transformación remota de pago.
También sigue pendiente el perfil de renders con volumen y CPU controlados.
