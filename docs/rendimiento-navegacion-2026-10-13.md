# Navegación: anticipación del código por intención

13 de octubre de 2026. Cuarta entrega de rendimiento.

## Comportamiento

IntentLink prepara el módulo del destino después de 120 ms de puntero/foco.
Salir del enlace, perder foco o desmontarlo cancela el temporizador. En toque
anticipa al pointerdown. No prepara la ruta actual, ni destinos desconocidos.
Los enlaces continúan filtrados por los permisos y módulos existentes.

La anticipación se omite sin conexión, con Save-Data o con effectiveType
slow-2g/2g/3g cuando el navegador expone esa información. Sin información de
conexión se permite intención. Las promesas se deduplican y los fallos silenciosos
de anticipación se liberan para reintentar; la entrada normal mantiene los
límites de error y recuperación existentes.

createPreloadableRoute comparte el módulo resuelto entre enlace y ruta. Tras
precargar no vuelve a suspender al entrar. Entrada directa conserva lazy y
Suspense. Un fallo libera la solicitud y renueva el componente diferido para
un reintento. Los componentes conservan sus props tipadas.

Solo se anticipa código: no se montan pantallas, no se consultan datos del
destino ni se conserva una caché de precios/stock. Al navegar se revalidan las
consultas habituales. Los borradores y la venta viven en sus contextos previos.

## Medición controlada

Chromium headless, builds de producción en HTTP local, contexto nuevo sin caché
ni service workers, API interceptada, un producto simulado, administrador,
1366 × 900. Recorrido: Catálogo → Inventario. Se añadió 200 ms de retraso a
la respuesta JS de InventoryPage y se señaló el enlace durante 600 ms antes
del clic en ambas variantes. Cronómetro dentro del navegador desde el evento
click real hasta localizar el control del producto en Inventario.

| Variante | Muestras desde clic (ms) | Mediana (ms) |
| --- | --- | ---: |
| Anterior (30e0e9a) | 373,5 / 835,2 / 372,0 | 373,5 |
| Módulo compartido y anticipación | 77,0 / 75,3 / 69,7 | 75,3 |

Tres muestras no constituyen una medición estadística de producción. El retraso
y la espera previa favorecen explícitamente este caso de uso. No se promete
ese porcentaje para clic inmediato, conexión real, datos voluminosos o servidor
lento. La anticipación no reduce el volumen total de los módulos visitados.

El primer prototipo solo adelantaba import() y no redujo consistentemente el
tiempo de entrada; se sustituyó por el cargador compartido. Los tiempos que
incluían autoesperas del ejecutor y las ejecuciones sobre una compilación
intermedia no se usan como resultado final.

### Red y costo

Antes y después de señalar Inventario, las consultas permanecieron:
profiles=1, tenant_modules=1, product_catalog=1, product_categories=1,
units_of_measure=1, products(costos)=1. Tras hacer clic se consultaron de nuevo
catálogo, categorías y unidades, más stock, mínimos y proveedores. Se verifica
así que el destino no realiza lecturas anticipadas ni reutiliza datos viejos.

El JavaScript acumulado del recorrido local sin comprimir pasó de 906.838 a
908.100 bytes (aproximadamente 1,3 kB de infraestructura adicional). El chunk
principal pasó de 323,70 a 324,97 kB; gzip aproximado 104,99 → 105,54 kB.
Si se señala un módulo y se abandona, se puede descargar código que no se usará;
el retardo y las restricciones de conexión limitan ese costo.

## Validación

- Pruebas de retardo/cancelación, ruta activa, desmontaje y políticas de conexión.
- Dedupe de módulo, entrada directa, entrada precargada sin fallback y recuperación.
- Regresiones de permisos/menú y preferencias de barra lateral.
- Chromium con puntero y foco de teclado; menú móvil 390 × 844.
- API interceptada, cero escrituras y cero errores no controlados.
- Tipos, compilación y lint.

## Pendiente

Las fotos nuevas ya se comprimen al subir, hasta 1.200 px; los listados usan
originales con lazy loading. No se cambian URLs ni se presupone soporte remoto
de transformaciones. La descarga y optimización de fotografías existentes sigue
pendiente, igual que perfiles de render con volumen y CPU controlados.
No se requiere SQL ni cambios de Supabase.
