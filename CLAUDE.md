# CLAUDE.md — Sunname ERP

> Sistema de gestión de negocio (ERP ligero + POS) **multi-vertical**, pensado para ser **modular, escalable, replicable** a cualquier tipo de negocio (ferretería, consultorio dental, comercio, abarrotes, servicios, etc.) y con una identidad visual propia, premium y genérica.

---

## 0. Cómo usar este archivo

- Este es el **manual operativo del proyecto** para Claude Code. Es la fuente de verdad para _cómo_ trabajamos, _qué_ construimos y _qué reglas_ seguimos.
- **Mantenlo actualizado**: tras cada decisión importante (stack, arquitectura, módulo nuevo, cambio de alcance), actualiza la sección correspondiente y agrega una línea en el §15 (Registro de decisiones). No esperes a que se te pida.
- Mantén este archivo **conciso**. El detalle largo (especificaciones de módulos, casos de uso por vertical) va en `docs/`, no aquí.
- README.md llegará después: documentación para humanos (instalación, uso). Este archivo es para el agente.

---

## 1. Visión del producto

Construir un sistema de **gestión de negocio** (CRM + Compras + Inventario + Facturación + Caja, con más módulos a futuro) que sirva para **cualquier tipo de negocio**: ferretería, consultorio dental, comercio al detalle, abarrotes, consultorio médico, etc. No es un producto vertical (ya no está atado a "tienda a granel de chiles y moles"): ese caso de uso pasa a ser **un módulo/plantilla más**, no el corazón del sistema.

- **Construido a la medida, deliberadamente independiente de Odoo**: el objetivo explícito es tener una alternativa propia para ofrecer a negocios que no quieren Odoo (o algo similar), no una extensión de Odoo. Es una decisión de producto tomada a propósito, no por desconocimiento de la alternativa.

- **Multi-vertical**: el núcleo (usuarios, permisos, catálogo de productos/servicios, movimientos de caja, inventario, CRM) debe ser genérico. Lo específico de cada giro (venta a granel por peso, citas médicas, órdenes de trabajo de taller, etc.) se resuelve como **módulos o configuraciones activables**, no como lógica hardcodeada en el núcleo.
- **Replicable / multi-tenant**: lo que se construye debe poder desplegarse para distintos negocios con mínima configuración (visión SaaS).
- **Escalable**: desde un negocio chico de un solo local y sin facturación, hasta uno con múltiples locales, pagos electrónicos y facturación fiscal.
- **Modular**: cada módulo (caja, inventario, CRM, compras, facturación, reportes) debe ser activable/desactivable de forma independiente.
- **Premium pero simple de usar**: nivel de acabado visual y de UX comparable a los sistemas líderes del mercado, sin sacrificar velocidad ni claridad.

---

## 2. Conectividad: online-first, no offline-first (decisión revisada)

**Cambio respecto a la versión anterior de este documento.** La versión original definía el proyecto como _offline-first_. Se redefine así:

- El sistema se diseña **online-first**: se asume que la inmensa mayoría de los negocios objetivo (ferretería, consultorio, comercio, abarrotes) tienen acceso a internet razonablemente estable, igual que asumen la mayoría de los POS comerciales modernos (Square, Clover, el propio Odoo POS, etc.).
- Esto **simplifica muchísimo la arquitectura**: no se necesita un motor de sincronización bidireccional complejo (PowerSync/ElectricSQL) ni resolución de conflictos multi-dispositivo como requisito base. Se reduce tiempo de desarrollo, superficie de bugs y costo de infraestructura.
- Es además más **coherente con la Fase 4 (facturación CFDI 4.0)**: timbrar ante un PAC ya requiere internet en tiempo real, así que un sistema 100% offline-first terminaría necesitando online de todos modos para esa pieza.
- **Pero** no se recomienda ir a "online-only" sin ningún colchón: los cortes de conexión existen (ISP local, corte eléctrico, WiFi del negocio) y en el módulo de **Caja** perder la capacidad de cobrar durante un corte sí es costoso para el negocio.
- **Recomendación concreta**: arquitectura **online-first con resiliencia local acotada** — solo las operaciones críticas de venta/caja se encolan localmente (IndexedDB/local storage) si se pierde la conexión, y se sincronizan automáticamente al recuperarla. El resto del sistema (CRM, reportes, compras, facturación, configuración) puede requerir conexión sin problema. Esto evita construir un sistema offline-first completo (caro, complejo, propenso a bugs de sincronización) mientras se conserva lo único que realmente importa: que la caja no se caiga por un corte de internet de 10 minutos.

> Respuesta directa a tu pregunta: sí, para un sistema pensado para muchos negocios distintos, **online-first es la mejor opción**. Offline-first total solo se justificaría si el público objetivo tuviera conectividad crónicamente mala (zonas rurales sin cobertura, por ejemplo), que no es el caso que describes.

---

## 3. Módulos (alcance funcional)

Módulos previstos desde ahora, con posibilidad de agregar más a futuro sin romper el núcleo:

- **CRM** — clientes, contactos, historial de interacción/compra.
- **Compras** — proveedores, órdenes de compra, recepción de mercancía.
- **Inventario** — existencias, movimientos, múltiples unidades de medida, alertas de stock.
- **Facturación** — cotizaciones, notas de venta, factura fiscal (CFDI 4.0 en fase avanzada).
- **Caja** — apertura/cierre de caja, cobros, métodos de pago, arqueo.
- _(Futuro, no bloqueante para el MVP)_: contabilidad, citas/agenda (útil para dentista/doctor), órdenes de trabajo/servicio, reportes avanzados, multi-almacén, **fotos de producto en Catálogo** (ayuda sobre todo en giros con muchas variantes parecidas, como Del Campo — chile Ancho/Guajillo/Pasilla en distintas presentaciones; técnicamente es solo un bucket de Supabase Storage + columna `image_url`, no requiere tocar lo ya construido), **IA** (ver §14 — módulo opcional, no forma parte del núcleo).

Cada módulo debe poder activarse o desactivarse por negocio/tenant, y el núcleo no debe asumir que todos los módulos están presentes.

---

## 4. Alcance y fases

> Regla: **MVP primero, luego capas.** No se empieza contabilidad ni facturación fiscal hasta que el flujo base (catálogo + caja + inventario) esté sólido en un solo vertical piloto.

- **Fase 0 — Decisiones y setup**: resolver §13, definir stack, crear repo, estructura base, identidad visual genérica.
- **Fase 1 — MVP**: un solo local · catálogo de productos/servicios genérico · caja básica (con resiliencia local ante cortes) · inventario básico · reportes básicos.
- **Fase 2 — Operación**: roles/usuarios · códigos de barras · CRM básico · compras básicas.
- **Fase 3 — Crecimiento**: multi-local · pagos con tarjeta/transferencia · contabilidad · módulos específicos por vertical (venta a granel, agenda de citas, etc.).
- **Fase 4 — Avanzado**: facturación **CFDI 4.0** (vía PAC) · multi-empresa / modo SaaS completo para replicar a otros negocios · marketplace de módulos por vertical.

---

## 5. Requisitos no funcionales (restricciones de arquitectura)

- **Online-first con resiliencia acotada**: ver §2. Solo caja necesita cola local ante cortes de conexión.
- **Multi-tenant desde el diseño**: aislamiento de datos por negocio, aunque la fase 1 solo tenga un tenant real.
- **Multi-dispositivo**: PC del negocio como dispositivo principal, móvil para consulta y tareas ligeras del dueño/encargado. **Diseño responsivo obligatorio.**
- **Gestión de usuarios y accesos fácil**: alta de usuarios, roles y permisos debe poder hacerse desde la UI, sin intervención técnica, desde el día uno.
- **Rápido**, con **UI moderna, premium**, sin sobrecarga visual. Prioridad: claridad y velocidad de uso.
- **Seguridad seria** desde el día uno (autenticación, control de acceso por rol/módulo, manejo de datos sensibles — especial cuidado en verticales como salud, donde puede haber datos personales sensibles).
- **Sin deuda técnica**: resolver pronto lo que costaría caro después. Sin código muerto, sin duplicación, sin redundancia.
- **Arquitectura preparada para crecer**: agregar un módulo o un vertical nuevo no debe implicar reescribir el núcleo.

### 5.1 Modelo de licenciamiento / planes

- **Suscripción mensual por negocio (tenant), no por usuario.** En caja/POS lo relevante es el negocio y sus locales, no el número de personas que lo usan; cobrar por asiento penaliza dar acceso a más empleados.
- **Planes por paquete de módulos** (no à la carte por ahora): p. ej. _Básico_ (Caja + Inventario), _Profesional_ (+ CRM + Compras), _Avanzado_ (+ Facturación/CFDI). El à la carte se evalúa más adelante, cuando haya varios tenants y datos reales de qué módulos usa cada quién.
- **Sin cobro por transacción/uso** por ahora — genera fricción en negocios pequeños y es difícil de calibrar sin datos de uso reales.
- **Para el MVP (un solo tenant piloto)**: no formalizar tiers todavía. Tarifa fija simple para el piloto; los planes reales se definen con el segundo o tercer cliente.

---

## 6. Roles y permisos (propuesta a validar)

| Rol                           | Para qué                   | Accesos típicos                                                                      |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| **Propietario / Super admin** | El dueño                   | Todo: configuración, usuarios, precios, reportes financieros, multi-local            |
| **Administrador de local**    | Encargado de una sucursal  | Operación de su local, inventario, reportes de su local, gestión de cajeros          |
| **Cajero / Vendedor**         | Operación diaria           | Vender, abrir/cerrar caja, consultar productos. Sin acceso a costos ni configuración |
| **Contador** (Fase 3+)        | Tareas fiscales/contables  | Reportes contables, facturación. Solo lectura sobre operación                        |
| **Consulta (dueño en móvil)** | Ver el negocio desde fuera | Dashboards, reportes, ventas en vivo. Solo lectura + acciones puntuales              |

> Recomendación: permisos **granulares por módulo** (no solo por rol), para que el modelo escale a distintos tipos de negocio sin rediseñar el RBAC cada vez.

---

## 7. Identidad visual

- **Nombre del producto: Sunname ERP.**
- **Paleta de colores — definida**: dos colores de identidad + neutrales + dos semánticos, sin exceso de color:
  - **Índigo profundo** `#1E2A47` — primario (header, sidebar, botones primarios, texto de marca).
  - **Dorado apagado** `#C9A227` — único acento (CTAs, totales, estados activos). Se usa con moderación.
  - **Grafito** `#2B2B2E` — texto principal.
  - **Gris cálido claro** `#F1EFEA` — fondo.
  - **Verde salvia** `#3B7A57` — éxito/confirmación (semántico, apagado, no verde de semáforo).
  - **Terracota** `#B23A34` — alerta/error (semántico, apagado).
- **Sin emojis** en ningún lado (UI, código, documentos). Set de iconos consistente — recomendación: **Lucide** (o Phosphor / Tabler).
- Estética: moderna, atractiva, sobria. Menos es más.
- Tipografía: pendiente de elegir (Fase 0), coherente con la paleta anterior.

**Identidad del producto vs. branding del tenant — principio de diseño:**

- El **chrome del sistema** (dashboard, caja, inventario, menús) usa siempre la identidad de **Sunname ERP** (índigo/dorado), sin importar el negocio que lo use — igual que Odoo se ve como Odoo o Square se ve como Square, independientemente de quién lo opere.
- El **branding de cada negocio/tenant** (p. ej. el verde de la marca de la tienda de chiles/moles) vive únicamente en lo que ven los **clientes finales de ese negocio**: ticket impreso, etiquetas, encabezado del recibo — nunca en la interfaz interna del sistema.
- **Regla de implementación desde el día uno**: ningún color va hardcodeado en el código de UI — todo pasa por variables/tokens de tema. Esto no cuesta más ahora y deja la puerta abierta a que el logo/color del tenant en tickets/etiquetas sea configurable por negocio en el futuro, sin tener que repintar el sistema completo por cliente.

---

## 8. Stack tecnológico — CONFIRMADO (con una tensión a vigilar)

**Confirmado:**

- **TypeScript** en todo el proyecto · monorepo.
- **UI**: React + Vite + Tailwind + componentes accesibles (shadcn/ui sobre Base UI) · iconos Lucide · react-router-dom.
- **Aplicación**: **web app estándar** (no requiere shell nativo tipo Tauri como base, al dejar de ser offline-first). Servida como **PWA responsiva** para PC y móvil.
- **Resiliencia de caja**: cola local ligera (IndexedDB) solo para operaciones de venta/caja, con reintento automático de sincronización — no un motor de sync completo para todo el sistema.
- **Hardware por vertical (opcional)**: para verticales que necesiten báscula, impresora de etiquetas u otro periférico (p. ej. venta a granel), se contempla un **módulo nativo opcional** (Tauri) que se activa solo si ese vertical lo requiere. No es parte del núcleo.

**Backend y multi-tenant — decidido, con una tensión que hay que vigilar:**

- **Multi-tenant: una base de datos por negocio** (no esquema/RLS compartido). Es la opción más aislada y simple de razonar (un negocio nunca puede ver ni por error los datos de otro), y es la preferencia explícita del proyecto.
- **Backend gestionado: Supabase** (Postgres + Auth) para no operar infraestructura desde el día uno.
- **La tensión a vigilar**: el modelo "una base de datos por negocio" y "Supabase" no son gratis de combinar a escala. Supabase está pensado como _un proyecto = una instancia de Postgres_; si cada negocio-cliente tiene su propia base, cada uno implica su propio proyecto de Supabase con su propio costo mensual (aprox. desde ~$25 USD/mes en el plan Pro por proyecto, sujeto a cambios — verificar precio vigente). Para el vertical piloto (un solo tenant) esto no importa nada. Pero si el modelo de negocio es vender a **muchos negocios pequeños con cuota modesta**, el costo de una instancia dedicada por cliente puede no ser rentable frente a una arquitectura de base compartida con RLS.
- **Recomendación práctica**: arrancar con base de datos por negocio (como se decidió) para el piloto y los primeros clientes, pero **diseñar el esquema desde ya compatible con una migración a RLS compartido** (mismo modelo de datos, mismas migraciones) por si el costo por-tenant se vuelve un problema al crecer. No es necesario decidirlo hoy — es una revisión a hacer en Fase 3 con datos reales de cuántos clientes y a qué precio.
- **Nota aparte sobre Supabase**: no hay región de Supabase en México; las más cercanas suelen ser en EE. UU. o Brasil (verificar disponibilidad vigente). Para un POS esto no suele ser un problema de latencia perceptible, pero vale la pena probarlo con datos reales antes de comprometerse del todo.

---

## 9. Hardware (opcional, por vertical)

El sistema **no asume hardware específico** en el núcleo. Cada vertical puede requerir periféricos distintos:

- **Báscula con interfaz** (serie/USB): relevante solo para negocios con venta a granel/por peso.
- **Lector de código de barras**: relevante para inventario/retail en general — la mayoría funciona como teclado (HID), integración trivial.
- **Impresora de etiquetas térmica**: solo si el negocio la necesita.
- **Terminal de pago con tarjeta**: relevante en fases posteriores para varios verticales.

> Acción: cuando se defina el primer vertical piloto, se investigan modelos concretos con pros/contras, precio aproximado y compatibilidad con el stack.

---

## 10. Reglas de trabajo para Claude Code (cómo debes comportarte)

- Actúa como **arquitecto de software senior**, **diseñador UX/UI experto** y **redactor**.
- **Guía honesta, no complacencia**: si se pide algo que daña el sistema, dilo y propón mejor camino. No des la razón si no la hay. Si algo va bien, dilo también.
- Antes de construir algo grande, **contextualiza y propón** (decisiones, trade-offs) en vez de ejecutar a ciegas.
- **Referencia de clase mundial**: Sunname ERP tiene identidad visual propia (§7) y no es un clon de nadie, pero al diseñar un flujo (caja, catálogo, inventario, etc.) vale la pena mirar qué resuelven bien sistemas líderes (Square, Toast, Clover, Shopify POS, Odoo) — patrones de UX, atajos, validaciones — y adaptar lo que aplique a Sunname, no reinventar desde cero lo que el mercado ya resolvió bien. La identidad de marca es de Sunname; los buenos patrones de producto pueden venir de donde sea.
- **Cero deuda técnica deliberada**: nada de "lo arreglo después". Sin código muerto, duplicado ni redundante.
- **Mejores prácticas** de arquitectura, seguridad y código limpio en cada commit.
- **Sin emojis**. Iconos para la UI.
- **Git/GitHub** para todo el desarrollo (ver §11).
- **Mantén este `CLAUDE.md` actualizado** tras cambios importantes y registra la decisión en §15.
- Avisa si se necesita una **skill o herramienta** instalada/configurada en Claude Code antes de avanzar.

---

## 11. Estándares de código y flujo de trabajo (se concreta al fijar el stack)

- **Git/GitHub**: ramas por feature, commits descriptivos (Conventional Commits recomendado), PRs revisables. Definir estrategia de ramas.
- **Calidad**: linter + formateador + types estrictos · pruebas para la lógica crítica (caja, inventario, permisos).
- **Estructura**: modular por dominio (no por tipo de archivo), para que cada módulo (caja, inventario, CRM, compras, facturación) sea aislable y activable de forma independiente.

**Modularidad "fácil de integrar y quitar" — cómo se logra sin sobre-construir:**

- **Límite de módulo estricto**: cada módulo vive en su propia carpeta/paquete, con su propio modelo de datos y su propia API interna. Un módulo **nunca** importa directamente las tablas o funciones internas de otro — si necesita algo de otro módulo, pasa por una interfaz/evento definido explícitamente. Esta disciplina es la que realmente hace que un módulo se pueda quitar sin romper los demás; es barata de mantener si se respeta desde el commit uno, y muy cara de arreglar después si no.
- **Registro de módulos por tenant**: una tabla de configuración simple (`tenant_modules`: qué módulos tiene activos cada negocio) controla qué se muestra/permite por negocio. Esto ya estaba implícito en el modelo de licenciamiento por paquetes (§5.1) — es el mismo mecanismo.
- **Feature flags** dentro de un módulo para funcionalidades más finas (p. ej. "venta a granel" dentro de Inventario), sin necesidad de que sea un módulo separado.
- **Lo que NO conviene construir todavía**: un sistema de plugins de verdad (SDK para que terceros escriban módulos, carga dinámica de código en tiempo de ejecución, marketplace de instalación) — eso es lo que a Odoo le tomó años madurar, y construirlo antes de tener varios verticales reales usándolo es resolver un problema que aún no tienes con datos. "Fácil de integrar y quitar" para el MVP significa: módulos con límites limpios que se **activan/desactivan por configuración**, no un runtime de plugins de terceros. Esa pieza se revisita cuando haya evidencia real de qué funcionalidades pide la gente y con qué frecuencia.

- **Seguridad**: validación de entradas, manejo de secretos fuera del repo, control de acceso por rol/módulo, registro de auditoría en operaciones sensibles (caja, precios, usuarios).

---

## 12. Antes de empezar — checklist de prerrequisitos

- [x] Definir **nombre del proyecto/producto**: **Sunname ERP**.
- [x] Definir paleta de colores (§7). Tipografía aún pendiente (Fase 0).
- [ ] Cuenta y **repositorio en GitHub** creados.
- [ ] Decidir los puntos del §13.
- [x] **Vertical piloto**: **Del Campo** — tienda de chiles, moles y semillas.
- [ ] (Fase 1) Catálogo real de productos del vertical piloto, con precios y unidades.
- [ ] (Si aplica al vertical piloto) Modelo de hardware necesario y su documentación.
- [ ] (Fase 4) Datos fiscales + contrato con un **PAC** para CFDI 4.0.
- [ ] Confirmar **skills/herramientas** que Claude Code necesite (se define al fijar stack).

---

## 13. Decisiones pendientes (resolver ANTES de codear)

1. **¿Construir desde cero o sobre una base existente?** — Resuelto: **a la medida, deliberadamente independiente de Odoo**. El sistema se piensa como una alternativa propia a ofrecer a negocios que no quieren Odoo.
2. **Stack tecnológico** (§8): confirmado.
3. **Nube/backend**: Supabase, con la tensión de costo por-tenant anotada en §8 a revisar en Fase 3.
4. **Multi-tenant**: decidido — **una base de datos por negocio**, con nota de diseño para poder migrar a esquema compartido si el costo por-tenant se vuelve un problema al crecer (§8).

> ~~¿Offline-first vs online-first?~~ — Resuelto en §2: **online-first con resiliencia acotada en caja**.
> ~~Vertical piloto para el MVP?~~ — Resuelto: **Del Campo**, tienda de chiles, moles y semillas.
> ~~Modelo de licenciamiento/planes?~~ — Resuelto en §5.1: **suscripción por negocio (tenant), no por usuario**, sin formalizar tiers todavía (un solo tenant piloto por ahora).
> ~~Nombre del producto y paleta de colores?~~ — Resuelto en §7: **Sunname ERP**, paleta índigo profundo + dorado apagado + neutrales + semánticos.

**No queda ninguna decisión abierta en esta lista.** Con esto, §13 está formalmente cerrado — se puede pasar a Fase 0 (setup) del §4.

**Deliberadamente pospuesto, no pendiente de decidir ahora:**

- **Modelo de datos de "servicios"**: el sistema se centra primero en productos; el modelo de servicios (citas, duración, recursos) se diseña después de tener el sistema de productos terminado, no antes.
- **Campos configurables por vertical**: no se define en abstracto con un solo vertical. Se resuelve con evidencia real cuando se incorpore el segundo vertical, no antes.

---

## 14. IA responsable y consideraciones operativas adicionales

### 14.1 IA — criterio de inclusión, no lista de funciones

- **IA es un módulo opcional más**, activable/desactivable por tenant igual que los demás (§11) — no vive dentro del núcleo ni se mete en flujos que ya funcionan bien sin ella.
- **Regla de inclusión**: una funcionalidad de IA entra al roadmap solo si resuelve un problema real y concreto mejor de lo que se resuelve sin IA — nunca porque "hay que tener IA". Si un cálculo es determinista y ya funciona (p. ej. peso × precio = importe), no necesita IA encima; eso sería complejidad sin beneficio.
- **Candidatos con valor real, a evaluar cuando el núcleo esté sólido** (no antes, y no todos a la vez — elegir uno, medir si de verdad ahorra tiempo, luego el siguiente):
  - Captura de facturas/tickets de proveedor por foto → llenar Compras automáticamente (ahorra captura manual).
  - Sugerencias de reorden en Inventario basadas en patrones de venta/estacionalidad.
  - Búsqueda/reportes en lenguaje natural ("¿cuánto vendí de mole en abril?").
  - Detección de anomalías en arqueos de Caja (posibles errores de captura o mermas fuera de rango).
- **Explícitamente fuera por ahora**: chatbot genérico, asistente conversacional de propósito general, o cualquier feature de IA que se agregue solo por tendencia de mercado.

### 14.2 Otras cosas a resolver antes de que duelan (no bloquean Fase 0, pero conviene tenerlas en el radar)

- **Respaldo y recuperación por tenant**: con una base de datos por negocio (§8), definir desde Fase 1 una política simple de backups automáticos y cómo se restauraría un negocio si su base se corrompe.
- **Observabilidad**: registro de errores y monitoreo básico (p. ej. Sentry o similar) desde el MVP — en un sistema donde una falla en Caja significa que un negocio no puede cobrar, enterarte tarde de un error es el peor escenario.
- **Entornos y despliegue**: separar desarrollo/producción y tener un proceso de despliegue repetible desde el principio, aunque sea simple — evita que "probar algo nuevo" ponga en riesgo al tenant piloto que ya está operando.
- **Actualizaciones sin romper tenants en vivo**: cómo se despliega una migración de base de datos o un cambio de módulo cuando ya hay negocios reales usando el sistema (no es un problema del MVP con un solo tenant, pero si no se piensa la estrategia de migraciones desde ahora, se vuelve doloroso con el segundo o tercer cliente).
- **Aviso de privacidad y términos de servicio**: aunque el piloto sea un negocio propio/cercano, en cuanto haya un segundo cliente hace falta un aviso de privacidad (LFPDPPP) y términos de servicio — se vuelve más urgente en cuanto se sume un vertical de salud (dentista/doctor), por el tipo de datos que maneja.
- **CFDI 4.0 no es solo "conectar un PAC"**: incluye catálogos del SAT (claves de producto/servicio, unidades, régimen fiscal del emisor y receptor) — vale la pena investigarlo con tiempo antes de llegar a Fase 4, no dejarlo para el final.
- **Capacidad de tiempo real**: este proyecto se construye en paralelo al trabajo en Sunname Partners — conviene ser honesto sobre cuántas horas por semana se le puede dedicar, para que el alcance de cada fase sea alcanzable y no genere frustración por expectativas de tiempo poco realistas.
- **`tenant_modules` no está conectado a la UI todavía**: la tabla existe desde Fase 0 y ya tiene filas reales (catalog/inventory/cash/purchasing activos, crm/billing no), pero ningún módulo (Caja, Catálogo, Inventario, Reportes, Usuarios, Compras) revisa esa tabla — todos se muestran siempre. Un negocio que no usa Compras (p. ej. alguien que compra poco en Central de Abastos sin proveedores fijos) no se ve bloqueado por esto — Inventario ya permite entradas manuales sin proveedor — pero el módulo igual aparece en el menú aunque nunca lo use. Conectar esto (leer `tenant_modules` en el nav + gatear rutas, con una pantalla de Configuración para prender/apagar) es la pieza que falta para que "modular, activable por negocio" (§1, §11) sea real y no solo la intención.

---

## 15. Registro de decisiones (ADR ligero)

| Fecha         | Decisión                                                                                                                                                                          | Razón                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| _(pendiente)_ | Pivote de "tienda a granel de chiles/moles" a sistema **multi-vertical**                                                                                                          | Servir a cualquier tipo de negocio (ferretería, dental, comercio, abarrotes, etc.), no solo al caso original                           |
| _(pendiente)_ | **Online-first** en lugar de offline-first, con cola local solo en caja                                                                                                           | La mayoría de los negocios objetivo tiene internet; simplifica arquitectura y es coherente con CFDI (Fase 4), que ya requiere conexión |
| _(pendiente)_ | Identidad visual **genérica**, ya no ligada al negocio de chiles/moles                                                                                                            | El producto ya no es de un solo giro                                                                                                   |
| _(pendiente)_ | Módulos iniciales: CRM, Compras, Inventario, Facturación, Caja                                                                                                                    | Cobertura base común a la mayoría de negocios, con opción de crecer                                                                    |
| _(pendiente)_ | Vertical piloto del MVP: **Del Campo**, tienda de chiles, moles y semillas                                                                                                        | Es el negocio ya conocido a detalle; permite levantar catálogo real rápido                                                             |
| _(pendiente)_ | El sistema se centra primero en **productos**; el modelo de **servicios** se aborda después de terminar el sistema de productos                                                   | Evitar sobre-diseñar el núcleo antes de tener el caso de producto resuelto y probado                                                   |
| _(pendiente)_ | Licenciamiento: **suscripción por negocio (tenant)**, por paquete de módulos, sin tiers formales todavía                                                                          | Simplicidad para el MVP con un solo tenant; evita cobro por usuario o por transacción, que no encajan bien con un POS                  |
| _(pendiente)_ | Sistema **a la medida, independiente de Odoo**                                                                                                                                    | Se ofrece como alternativa propia a negocios que no quieren Odoo                                                                       |
| _(pendiente)_ | Nombre del producto: **Sunname ERP**; paleta: índigo `#1E2A47` + dorado `#C9A227` + neutrales + verde/terracota semánticos                                                        | Identidad genérica, premium, con un solo acento para no sobrecargar la UI                                                              |
| _(pendiente)_ | El vertical piloto (chiles/moles/semillas) usa la identidad de **Sunname ERP**, no la marca del negocio; el branding del negocio queda solo en tickets/etiquetas de cliente final | Separar identidad del producto vs. branding del tenant; evita repintar el sistema por cada cliente                                     |
| _(pendiente)_ | Modularidad vía **límites de módulo + activación por configuración (`tenant_modules`)**, no un runtime de plugins de terceros                                                     | Suficiente para "fácil de integrar y quitar" en el MVP; un SDK de plugins real se evalúa después, con evidencia de varios verticales   |
| _(pendiente)_ | **IA como módulo opcional**, con criterio de inclusión por valor real (no por tendencia)                                                                                          | Evitar IA forzada; se agrega solo cuando resuelve mejor un problema concreto que la alternativa sin IA                                 |
| 2026-08-20    | Primer esquema de base de datos (`supabase/migrations/20260820130031_init_core.sql`): `profiles`+`user_role`, `tenant_modules`, catálogo (`products`, `product_categories`, `units_of_measure`), inventario (`inventory_movements` + vista `inventory_stock`), caja (`cash_sessions`, `sales`, `sale_items`, `sale_payments`, `payment_methods`) | Arranca Fase 1 (catálogo + caja básica + inventario básico) sobre el modelo "una base de datos por negocio" del §8; sin tabla/columna `tenant_id` porque el aislamiento ya lo da la base de datos |
| 2026-08-20    | Permisos vía **RLS de Postgres basada en rol** almacenado en `profiles` (función `current_role_key()`), no roles nativos de Postgres/Supabase                                    | Permite alta de usuarios y roles desde la UI (§5) sin tocar roles a nivel de base de datos; deja lista la base para permisos granulares por módulo (§6) |
| 2026-08-20    | Inventario modelado como **bitácora de movimientos inmutable** (`inventory_movements`, solo insert) + vista `inventory_stock` calculada, sin columna de saldo mantenida a mano    | Evita que el saldo de existencias se desincronice de su propio historial; el costo de recalcular por vista es aceptable al volumen del MVP |
| 2026-08-20    | Toda tabla nueva debe llevar `GRANT` explícito a `authenticated` además de sus políticas de RLS (`supabase/migrations/20260820140358_grant_authenticated_privileges.sql`), y se dejó `ALTER DEFAULT PRIVILEGES` para que las tablas futuras lo hereden solo | RLS y GRANT son capas distintas en Postgres: una tabla creada por migración SQL (a diferencia del Table Editor de Supabase, que sí lo hace solo) no le da privilegios base a `authenticated`, así sus políticas de RLS existan — se detectó al probar el login real (error 42501) |
| 2026-08-20    | shadcn/ui corre sobre **Base UI**, no Radix (corrige el §8 original)                                                                                                                                                              | El CLI actual de shadcn (preset "Nova") trae Base UI por default; es igual de accesible y es lo que ya quedó instalado y funcionando — no vale la pena deshacerlo solo para volver a lo que decía el documento originalmente |
| 2026-08-20    | Tokens de tema separan `--accent` (hover/foco neutro que usan los componentes de shadcn en todas partes) de `--brand-gold` (el dorado de marca, aplicado a mano solo en CTAs/totales/estados activos)                             | Si el dorado ocupara el slot `--accent` de shadcn, aparecería en cada hover de menú/botón ghost, violando "se usa con moderación" del §7 |
| 2026-08-20    | Auditoría de seguridad (`supabase/migrations/20260820173415_security_hardening.sql`): `create_sale` pasa a `security definer` con autorización y precio explícitos adentro; `sales`/`sale_items`/`sale_payments`/`inventory_movements` ya no aceptan insert directo de un cajero (solo owner/local_admin, o vía la función); `handle_new_user` ya no confía en el rol de los metadatos del signup; trigger nuevo evita que cualquiera cambie su propio rol/estado | Se probaron en vivo y se confirmaron explotables antes de corregir: autorregistro público como `owner` sin autenticarse (vía `/auth/v1/signup` con la anon key — cualquiera podía apropiarse el tenant), un cajero podía forjar `unit_price` en `create_sale` para quedarse con la diferencia en efectivo, y podía insertar movimientos de inventario 'out' sin una venta real detrás. Ver detalle completo en el reporte de auditoría de esa fecha |