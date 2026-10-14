# Catálogo: una sola presentación montada

13 de octubre de 2026. Tercera entrega de rendimiento.

## Hallazgo y cambio

En modo tabla, ProductDirectory construía simultáneamente tarjetas y filas:
CSS ocultaba una de las presentaciones. Cada actualización montaba dos juegos
de miniaturas, información de precios y acciones, aunque uno no se veía.

Ahora se monta tabla solo cuando se seleccionó ese modo y coincide el breakpoint
de escritorio de CSS (min-width: 64rem). En los demás casos se montan tarjetas.
useMediaQuery usa useSyncExternalStore y escucha cambios de matchMedia, en lugar
de cada evento resize. Limpia la suscripción al desmontar. El entorno sin
matchMedia usa escritorio como fallback; las pruebas móviles definen su ancho.

Los filtros, selección de vista y paginación continúan en ProductsTab; cambiar
el ancho no cambia esos estados ni los productos, precios o permisos.

## Evidencia

Comparación local con React Testing Library/jsdom entre el componente anterior
del commit 1d200dc y el nuevo, usando los mismos 25 productos con imágenes y
acciones. Las aserciones comprobaron:

| Elementos para una página | Antes | Después |
| --- | ---: | ---: |
| Elementos img montados en modo tabla | 50 | 25 |
| Invocaciones para construir acciones | 50 | 25 |

El arnés comparativo temporal se retiró después de verificar los resultados.
La regresión permanente ProductDirectory.test.tsx verifica presentación única,
25 imágenes, 25 construcciones de acciones, cambio de ancho, vista explícita
de tarjetas en escritorio y limpieza de suscripciones.

Chromium con build de producción, API interceptada y 25 productos simulados:
1366 × 900 → 390 × 844 → 1366 × 900. En cada ancho solo existió la presentación
correspondiente y 25 imágenes. El retorno a escritorio se probó con modo oscuro
y texto ampliado. Se abrió la etiqueta y se comprobó el SVG. Cero escrituras y
cero errores no controlados. No se accedió a producción.

Esta reducción de montajes no equivale a 50 % menos bytes de fotografías:
el navegador puede deduplicar URLs y diferir imágenes ocultas. No se midió
latencia de render ni memoria en bytes, por lo que no se promete un porcentaje
de mejora de velocidad. El hook añade aproximadamente 354 bytes al JavaScript
inicial del escenario de Catálogo.

## Validación y pendientes

Compilación de producción, lint y regresiones de tarifas, errores, acciones,
permisos y paginación. La prueba de ProductsTab ahora declara explícitamente un
viewport móvil para sus comprobaciones de tarjetas.

Sigue pendiente la medición de fotografías transferidas y recorridos entre
módulos con latencia/CPU controladas. Inventario también usa presentaciones
ocultas: se evaluará por separado para conservar foco del panel y sus estados.
No se añade caché de precios/stock ni modificaciones de base de datos.
