# Rendimiento de Catálogo: carga de etiquetas bajo demanda

13 de octubre de 2026. Segunda entrega de rendimiento.

## Hallazgo

ProductsTab importaba LabelPrintDialog y, a través de él, jsbarcode de forma
estática. Entrar al Catálogo descargaba ese código aunque no se imprimiera.
Las consultas observadas en una entrada fueron una por cada recurso:
profiles, tenant_modules, product_catalog, product_categories,
units_of_measure y products (costos de administrador). En este escenario no
hubo peticiones duplicadas: no justifica añadir una caché todavía.

## Implementación

LabelPrintDialog es ahora una entrada ligera con React.lazy y Suspense.
LabelPrintContent conserva el formulario y generador anteriores. El contenido
se solicita cuando hay un producto seleccionado; la carga ofrece Cancelar.
Un fallo queda acotado al diálogo y permite cerrar o reintentar creando una
nueva instancia lazy. No se modifican RPC, permisos, SKU ni impresión.

## Comparación en navegador

Dos builds de producción del mismo proyecto, antes y después del cambio.
Servidor HTTP local sin compresión, Chromium headless, contexto nuevo sin caché
ni service workers, escritorio 1366 × 900. API totalmente interceptada, un
producto simulado y una sesión simulada de administrador. Se esperó la acción
del producto y luego se abrió la etiqueta y se comprobó el SVG del código.

Se contabilizó el tamaño físico de cada archivo JS local solicitado por el
navegador (sin comprimir); no todos los archivos emitidos por Vite.

| Medida | Antes | Después |
| --- | ---: | ---: |
| JavaScript solicitado al entrar | 932.492 bytes | 867.415 bytes |
| Archivos JS al entrar | 37 | 37 |
| JavaScript adicional al abrir etiqueta | 0 bytes | 66.691 bytes |
| Chunk de Catálogo | 130,34 kB | 65,27 kB |

Reducción inicial neta: 65.077 bytes, aproximadamente 7 % del JavaScript
solicitado. El costo se aplaza: quien imprime descarga el generador al abrirlo.
La suma final incluye un pequeño costo de separación y recuperación.
El chunk diferido pesa 12,49 kB gzip; el ahorro de transferencia real depende de
la compresión y caché del servidor.

Tiempo hasta acciones disponibles en estas muestras: 1.835,8 ms antes y
1.138,9 ms después. Son muestras únicas locales, sin red real ni CPU limitada:
no se consideran prueba estadística de mejora de latencia ni presupuesto de
producción.

## Validación

- Compilación de producción y lint (avisos previos, uno trasladado al contenido).
- Pruebas de selección, cierre, recuperación y regresiones de ProductsTab.
- Chromium escritorio: carga inicial y apertura, código de barras renderizado.
- Chromium 390 × 844, oscuro y texto ampliado: apertura y código renderizado,
  sin desbordamiento horizontal del documento.
- Cero escrituras y cero errores no controlados en las comprobaciones normales.
- Las API externas se interceptaron; ninguna prueba escribió en producción.

## Pendiente

Medir recorridos entre módulos con volúmenes representativos y latencia/CPU
controladas, fotografías y renders. Las consultas al volver a una ruta siguen
revalidando: no se considera completada la auditoría ni implementada una caché.
