# Rendimiento: primera entrega — búsqueda de Caja

Fecha: 13 de octubre de 2026.

## Hallazgo y cambio

La búsqueda anterior normalizaba nombres y SKU por cada pulsación y volvía a
normalizarlos en el comparador de ordenación. SaleScreen ahora prepara un índice
con useMemo por referencia de catálogo y separa coincidencias en tres grupos:
SKU exacto, nombre exacto y parciales. Dentro de cada grupo conserva el orden
original. No añade dependencias, retardos al teclear, caché de red ni persistencia.

Una nueva respuesta de productos reconstruye el índice con los productos,
precios y disponibilidad recibidos. Se mantienen las validaciones de venta,
las consultas completas y la privacidad de costos.

## Comparación reproducible

Comando desde apps/web:

    pnpm exec vitest bench --run src/features/caja/productSearch.bench.ts --maxWorkers=1

Vitest 4.1.11, entorno local Windows/jsdom. Ambas implementaciones reciben los
mismos productos simulados, 10 % inactivos, nombres con acentos y siete consultas:
c, ca, caf, cafe, cafe molido, sku-25 e inexistente. Cada muestra ejecuta las
siete búsquedas. Tiempos medios en milisegundos de la ejecución local:

| Productos | Anterior | Índice preparado | Construcción + siete búsquedas |
| --- | ---: | ---: | ---: |
| 500 | 10,5405 | 0,2143 | 0,9916 |
| 5.000 | 116,75 | 2,2785 | 11,2669 |

La construcción también se mide: el ahorro no depende de ocultar su costo.
Los tiempos absolutos varían según equipo y carga; el benchmark no impone umbrales
en CI para evitar fallos por variaciones del ejecutor.

Estos resultados miden exclusivamente CPU del algoritmo. No representan la
latencia de Supabase, descarga de imágenes, montaje React ni carga inicial.
No hubo consultas ni escrituras a producción.

## Validación y alcance pendiente

Pruebas de prioridades, estabilidad del orden, acentos, SKU, categorías,
inactivos y reconstrucción con productos/precios actualizados; regresiones de
tarjetas y envío de ventas. Compilación de producción y lint.

La auditoría completa sigue pendiente: instrumentar navegación en build de
producción con API simulada y latencia controlada, medir transferencias reales,
descargas repetidas, imágenes y renders. Las lecturas actuales por instancia
pueden repetir catálogos al navegar; no se incorpora una caché sin estudiar
antes invalidación, cambios de sesión y frescura de precios/inventario.
