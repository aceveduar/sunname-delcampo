# Auditoría de usabilidad e interfaz — 11 de octubre de 2026

Base revisada: `7c654d35664c3818b9921c2ea386eb997a11fb82`.

Primera entrega: corregidos los puntos 1, 2, 4, 5 y 8. Configuración comparte
el estado de módulos con la navegación, distingue errores de carga y conserva
la captura al fallar un guardado. Categorías, unidades, invitaciones y nombres
usan un formulario común con guardado exclusivo, cierre protegido y confirmación
de descarte. Las confirmaciones de cambios de rol/estado quedan protegidas durante
la operación. También se protegió la carga del nombre del negocio y se distingue
el error de consulta fiscal en Facturación.

Segunda entrega: corregidos los puntos 3, 6, 7 y 9. Usuarios incorpora tarjetas
móviles, búsqueda sin acentos, filtros de rol/estado y paginación; las acciones
conservan los permisos del directorio. Facturación separa efectivo contado,
ventas del corte y total registrado en la solicitud. Añade filtros de fecha/estado
en servidor, páginas de veinte cortes, detalle de solicitud y errores recuperables.
Los hallazgos originales se conservan debajo como referencia de la auditoría.

La vista previa suma todas las páginas de ventas completadas, en centavos, con
el mismo criterio de la RPC existente. No bloquea el importe mientras se revisa:
si hay una anulación concurrente, la RPC calcula el total vigente al registrar
la solicitud y la interfaz muestra después ese total guardado. Un reintento
consulta primero si el corte ya tiene una solicitud, y también reconcilia una
respuesta fallida antes de informar que no pudo confirmarse. El timbrado con PAC
sigue pendiente; esta entrega no genera CFDI ni modifica las migraciones.

Validación de la segunda entrega: Chrome a 1366 × 900 y 390 × 844, modo oscuro
y texto al 125 %, con API simulada de 26 usuarios, 23 cortes y un corte de
501 ventas. Se comprobó búsqueda, formulario de nombre, paginación, filtros,
detalle con error y recuperación tras una consulta rechazada; cero escrituras
y cero peticiones a servicios reales. Pruebas automatizadas adicionales cubren
permisos de acciones, fechas inválidas, centavos, páginas incompletas, reintentos
y protección del diálogo durante el envío.

La revisión inicial se concentró en Configuración, Usuarios, Categorías,
Unidades y Facturación. Comparten el diseño del sistema, pero varios estados de
carga, permisos y guardado todavía dejan al usuario sin una respuesta clara.

## Seguimiento: Categorías y Unidades

Tercera entrega: ambos directorios comparten una presentación con búsqueda por
palabras sin acentos, filtros de estado, conteos y páginas de 25 registros.
Escritorio conserva tabla; móvil muestra tarjetas con nombre, categoría padre o
código, estado y acciones visibles. La consulta lee todas las páginas de la API
con orden estable para no omitir registros al buscar o contar.

Una actualización fallida conserva la última lista correcta, explica su estado
y bloquea crear, editar y cambiar estados hasta recuperar la consulta. Los cambios
de estado se ejecutan de uno en uno y permiten reintentar tras un fallo.

El formulario de categoría muestra la ruta completa del padre y excluye la
categoría editada y sus descendientes. Tolera relaciones antiguas incompletas o
cíclicas sin bloquear la pantalla. Es una prevención de selección en esta
interfaz; no añade una restricción transaccional a la base de datos. Las rutas
largas se ajustan tanto en el selector como en sus opciones. También se permite
encoger el formulario compartido para evitar desbordamientos con texto ampliado.

Al editar un producto se conserva visible su categoría o unidad original aunque
esté inactiva, identificada como tal. Esto evita un selector vacío y cambios
accidentales de asignación al modificar otros campos. Las demás opciones
inactivas siguen excluidas del formulario de producto.

Validación: Chrome a 1366 × 900, 390 × 844 y 360 × 740, con modo oscuro y texto
al 125 %. API simulada con 27 categorías, rutas largas y una unidad inactiva;
búsqueda, paginación, opciones jerárquicas, error/reintento y permisos de propietario
y cajero. Se comprobó el ancho del contenido de los diálogos y las opciones,
además del ancho de la página: cero escrituras y cero servicios externos.
Las pruebas automatizadas cubren además 501 categorías/unidades, filtros,
concurrencia de acciones, jerarquías cíclicas y conservación de asignaciones
inactivas al guardar un producto. Sin migraciones.

## Alcance y método

- Revisión de componentes, hooks, navegación y políticas SQL del repositorio.
- Reproducción en Chrome con componentes reales y respuestas de API simuladas.
- Pantallas de 1366 × 768 y 390 × 844, con datos ficticios y roles de propietario
  y cajero.
- Simulación de errores 503, escrituras rechazadas y peticiones lentas. Todas
  las escrituras se interceptaron; no se modificaron datos de producción ni se
  enviaron invitaciones.
- Esta revisión no certifica todos los flujos, navegadores o políticas desplegadas.
  Las observaciones SQL corresponden a las migraciones del repositorio.

## Hallazgos prioritarios

### 1. Un error de carga permite guardar datos fiscales vacíos

**Prioridad alta · Reproducido.** Después de un error 503 al consultar los datos
fiscales, Configuración muestra campos vacíos y habilita «Guardar datos fiscales».
Al pulsarlo, envía RFC, razón social, régimen y código postal como `null`.
Si la escritura posterior funciona, puede reemplazar información existente.

El hook comienza con valores vacíos, comunica el error mediante una notificación
y finaliza la carga sin exponer un estado de error al formulario.

**Corrección:** distinguir carga, error y datos disponibles. Mostrar un error
persistente con «Reintentar» y permitir editar únicamente tras una lectura válida.
Conservar el borrador cuando falle un guardado.

**Criterio de aceptación:** un GET fallido no habilita un formulario vacío ni
permite enviar una actualización; un reintento exitoso recupera los valores.

Referencias: [useTenantFiscalSettings.ts](../apps/web/src/features/settings/useTenantFiscalSettings.ts),
[SettingsPage.tsx](../apps/web/src/features/settings/SettingsPage.tsx).

### 2. Los interruptores de módulos y la navegación quedan desincronizados

**Prioridad alta · Reproducido.** Desactivar Clientes actualiza el interruptor y
la API simulada, pero «Clientes» sigue visible en la barra lateral. App y
Configuración mantienen instancias independientes de `useTenantModules`; la
actualización solo refresca la instancia de Configuración.

**Corrección:** compartir el estado de módulos entre configuración, navegación y
rutas. Mostrar progreso por interruptor y conservar el estado anterior si falla
la operación.

**Criterio de aceptación:** activar o desactivar un módulo actualiza menú y acceso
a la ruta sin recargar la aplicación. Un fallo no deja estados contradictorios.

Referencias: [useTenantModules.ts](../apps/web/src/features/settings/useTenantModules.ts),
[App.tsx](../apps/web/src/App.tsx).

### 3. Facturación muestra el efectivo contado como «Monto»

**Prioridad alta · Reproducido y contrastado con SQL.** Con un cierre de $800 y
una solicitud de factura de $1,250, la pantalla muestra únicamente $800 bajo
«Monto». El hook utiliza `closing_amount`, aunque ya recibe `fiscal_invoices.total`.
La función `request_global_invoice` calcula su total a partir de ventas completadas.

Son conceptos distintos: el efectivo contado puede incluir el fondo inicial y
movimientos, mientras que las ventas pueden incluir otros métodos de pago.

**Corrección:** identificar explícitamente «Efectivo contado» y «Total de la
solicitud». Mostrar el total registrado cuando exista una solicitud. Para cortes
sin solicitud, definir y consultar el mismo importe que utilizará la operación
antes de presentar una acción de confirmación.

**Criterio de aceptación:** el ejemplo de $800/$1,250 muestra ambos conceptos sin
confundirlos. La confirmación corresponde al importe de la solicitud.

Referencias: [useFiscalInvoices.ts](../apps/web/src/features/billing/useFiscalInvoices.ts),
[BillingPage.tsx](../apps/web/src/features/billing/BillingPage.tsx),
[fiscal_invoices.sql](../supabase/migrations/20260902120100_fiscal_invoices.sql).

### 4. El cajero recibe acciones de categorías que no puede completar

**Prioridad alta · Interfaz reproducida; permisos revisados en SQL.** Como cajero
aparecen «Nueva categoría», «Editar» y «Desactivar». Se puede abrir el formulario
y enviarlo, aunque las políticas del repositorio reservan esas escrituras a
propietario y administrador. Unidades tiene el mismo desacople por revisión de
código. Esto conduce a errores evitables; no demuestra un acceso indebido a datos.

**Corrección:** aplicar permisos a las acciones de Categorías y Unidades, como
ya ocurre en Productos. Mantener la consulta para los usuarios autorizados a leer.

**Criterio de aceptación:** un cajero consulta categorías y unidades sin recibir
acciones de escritura. Propietario y administrador conservan esas acciones.

Referencias: [CatalogPage.tsx](../apps/web/src/features/catalog/CatalogPage.tsx),
[CategoriesTab.tsx](../apps/web/src/features/catalog/CategoriesTab.tsx),
[UnitsTab.tsx](../apps/web/src/features/catalog/UnitsTab.tsx),
[políticas iniciales](../supabase/migrations/20260820130031_init_core.sql).

### 5. Algunos formularios no protegen una operación en curso

**Prioridad media · Reproducido.** Dos pulsaciones en «Crear categoría» durante
una respuesta lenta generan dos peticiones. En «Invitar usuario», los campos
siguen editables y la X permite cerrar el diálogo mientras se envía la solicitud.
Cerrar ese diálogo no cancela la operación y deja al usuario sin su contexto.

**Corrección:** impedir envíos concurrentes desde el manejador, mostrar progreso,
deshabilitar la edición durante el envío y definir un cierre seguro mientras esté
pendiente. Recuperar el estado con `finally` y conservar datos ante errores.
Aplicar el patrón compartido también a Unidades y edición de nombres.

**Criterio de aceptación:** doble clic o doble Enter produce una sola petición;
un error permite volver a intentar sin perder datos. Una operación pendiente no
desaparece al cerrar accidentalmente el diálogo.

Referencias: [CategoriesTab.tsx](../apps/web/src/features/catalog/CategoriesTab.tsx),
[InviteUserDialog.tsx](../apps/web/src/features/users/InviteUserDialog.tsx).

### 6. La tabla de Usuarios oculta información y acciones en móvil

**Prioridad media · Reproducido.** A 390 px de pantalla, la tabla tiene 752 px de
contenido dentro de 356 px visibles. Se ven el nombre y parte del selector de rol;
estado y acciones requieren desplazamiento horizontal.

**Corrección:** usar tarjetas en móvil con nombre, rol, estado y menú de acciones.
Mantener tabla en escritorio. Incorporar búsqueda por nombre y filtro de estado
cuando crezca la lista. Revisar Categorías y Unidades con el mismo criterio.

**Criterio de aceptación:** a 390 px se identifica y administra un usuario sin
desplazamiento lateral, incluso con nombres largos y texto ampliado.

Referencia: [UsersPage.tsx](../apps/web/src/features/users/UsersPage.tsx).

### 7. Facturación confunde errores con ausencia de registros

**Prioridad media · Reproducido.** Un error 503 en la primera carga termina en
«Sin cortes de caja cerrados», sin acción de reintento en la pantalla. El error
se comunica por notificación, pero la vista permanece como si la consulta hubiera
respondido correctamente con cero resultados.

**Corrección:** reutilizar el estado de error persistente y reintento que ya
existe en otros módulos. Reservar el estado vacío para consultas exitosas.

**Criterio de aceptación:** un fallo inicial muestra un error recuperable; cero
resultados reales muestran el estado vacío. Una recarga fallida conserva los
datos anteriores y avisa que no pudieron actualizarse.

Referencias: [useFiscalInvoices.ts](../apps/web/src/features/billing/useFiscalInvoices.ts),
[LoadError.tsx](../apps/web/src/components/LoadError.tsx).

### 8. Los interruptores de módulos no tienen nombre accesible

**Prioridad media · Reproducido por inspección del DOM.** Los tres interruptores
tienen texto visual a su lado, pero no una etiqueta asociada ni `aria-label` o
`aria-labelledby`. Un lector de pantalla no puede identificar con claridad qué
módulo modifica cada control.

**Corrección:** asociar cada interruptor con su título y descripción. Revisar
también las etiquetas de los selectores de régimen fiscal, rol y categoría padre.

**Criterio de aceptación:** el árbol de accesibilidad identifica nombre, estado
y descripción de cada interruptor; el flujo completo funciona con teclado.

Referencia: [SettingsPage.tsx](../apps/web/src/features/settings/SettingsPage.tsx).

### 9. El historial de Facturación termina en veinte cortes sin indicarlo

**Prioridad media · Confirmado en código, sin prueba de volumen.** La consulta
usa `limit(20)` y la pantalla carece de paginación o aviso del límite. Los cortes
más antiguos quedan fuera de esta vista. Además, se recibe `error_message` de la
solicitud, pero no se muestra su detalle.

**Corrección:** paginar por fecha e identificador, añadir filtros de fecha/estado
y abrir un detalle que explique el resultado o error de la solicitud.

**Criterio de aceptación:** con más de veinte cortes se pueden consultar los
anteriores; una solicitud con error ofrece información útil para resolverlo.

Referencia: [useFiscalInvoices.ts](../apps/web/src/features/billing/useFiscalInvoices.ts).

## Orden recomendado de implementación

1. Configuración: carga segura, estado compartido de módulos y etiquetas accesibles.
2. Formularios y permisos: categorías, unidades e invitaciones sin envíos repetidos
   ni acciones que el rol no puede usar.
3. Usuarios en móvil: tarjetas, jerarquía de información y acciones visibles.
4. Facturación: importes explícitos, recuperación de errores, detalle e historial.

Reutilizar los componentes de error, formularios y presentación que ya existen;
extraer comportamiento compartido cuando evite duplicación. Validar los cambios
con respuestas lentas, fallos de red, roles distintos, teclado y texto ampliado.
El objetivo es que la siguiente acción y el resultado de cada operación sean
claros en todas las pantallas.

## Seguimiento: Productos — 13 de octubre

Cuarta entrega: el directorio de Productos separa sus controles, presentación y
operaciones. La tabla de escritorio agrupa foto, nombre y código; las tarjetas
móviles conservan el nombre completo, categoría, unidad, precios, estado y acciones.
La presentación responde a cambios de tamaño sin recargar y ofrece tabla/tarjetas
en escritorio. Las fotos tienen espacio interior y mantienen sus proporciones.

La búsqueda acepta palabras repartidas entre nombre y código sin depender de
acentos. Todos los filtros vuelven a la primera página y «Limpiar filtros» también
limpia la búsqueda. Las categorías inactivas aparecen identificadas para poder
encontrar productos que todavía las tienen asignadas.

La lectura pública recorre todas las páginas de la API con orden estable. Los
costos se consultan por separado y únicamente para administradores; sus alertas de
margen se ocultan durante la carga o ante errores. Una página fallida no reemplaza
el catálogo anterior con un resultado parcial. Se ofrece reintento y se bloquean
acciones mientras la consulta de productos o sus referencias no esté disponible.

Cambiar estado y borrar comparten un bloqueo síncrono contra pulsaciones repetidas.
El borrado pendiente impide cerrar la confirmación; un fallo conserva el producto
para reintentar. Las actualizaciones exigen recibir la fila afectada antes de
anunciar éxito. El editor de precios conserva el borrador y bloquea confirmar
mientras una consulta esté fallando.

Validación: pruebas de 501 productos/costos, fallos en páginas posteriores,
actualizaciones sin fila devuelta, filtros/paginación, roles, concurrencia,
reintentos y recuperación del editor. Revisión en Chrome a 1366 × 900,
390 × 844 y 360 × 800, con nombres/categorías largos, modo oscuro y texto al 125 %.
Se verificaron consulta por código posterior al registro 500, categorías inactivas,
cambio de ancho, formulario móvil, error/reintento y cajero sin costos.
API totalmente simulada: cero escrituras y cero peticiones a servicios reales.
Esta entrega no modifica SQL ni certifica los flujos de lectura de fotos.

### Pulido tras revisar la captura de producción

Las tarjetas reúnen precio, estado y acciones en un pie adaptable para reducir
su altura; las fotos crecen a 64 px conservando margen interior y proporciones.
La tabla mantiene fotos de 56 px. No se recortan los nombres de los productos.

Se añade paginación superior cuando hay varias páginas, compartiendo estado con
la inferior. Ambas regiones tienen nombres accesibles distintos. Los precios en
cero se identifican como «Sin precio»; en granel se conserva visible cualquier
tarifa válida de 100 g y se identifican tarifas pendientes. La alerta de producto
activo sin precio permanece. Los datos y cálculos de venta no se modifican.

Pruebas de regresión cubren recorrido desde ambos controles y sus límites,
además de precios pendientes/vigentes en tabla y tarjetas.
Revisión visual en Chrome a 1366 × 900, 390 × 844 y 360 × 800 con 212 productos
simulados, modo oscuro y texto ampliado. Se comprobó la sincronización desde ambos
controles, el margen interior de fotos, las tarifas pendientes y las alertas,
además del ancho de cada tarjeta y de la página: sin desbordamientos, escrituras
ni peticiones a servicios externos. Compilación y pruebas de los cambios aprobadas.
El segundo ajuste de textos elimina el conteo adicional sobre la paginación:
la superior muestra el rango y total, también cuando solo hay una página.
La inferior aparece únicamente si hay varias páginas. Cero resultados conserva
su mensaje explícito. Si faltan ambas tarifas de granel queda una sola indicación
«Sin precio»; una tarifa de 100 g válida sigue visible y el aviso específico de
100 g faltante se conserva cuando sí hay precio por kilo. Se mantienen las alertas
operativas y no se modifican importes. Regresiones cubren tabla, tarjetas y un
filtro que reduce varias páginas a un solo resultado.