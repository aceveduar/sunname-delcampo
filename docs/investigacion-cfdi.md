# CFDI 4.0 — investigación previa a Fase 4

> Este documento es investigación, no una implementación. Fase 4 (facturación fiscal) sigue sin empezar -- el objetivo aquí es no llegar a esa fase desde cero, como ya advertía CLAUDE.md §14.2. Nada de lo que sigue requiere tocar código todavía.

## El punto central: dos flujos distintos, y el que de verdad importa es el que no se ve

Casi toda la documentación sobre CFDI habla del caso "el cliente pide factura con su RFC" -- pero para un negocio como Del Campo (mostrador, clientes que casi nunca piden factura), **el flujo relevante es otro**:

1. **Factura individual bajo pedido** -- el cliente da su RFC real, régimen fiscal y uso de CFDI. Poco frecuente en un negocio de mostrador.
2. **Factura global periódica** -- todas las ventas del día/semana/quincena a clientes que NO pidieron factura se agrupan en un solo CFDI, emitido al RFC genérico `XAXX010101000` ("público en general"), dentro de las **72 horas** siguientes al cierre del periodo que se está facturando.

La factura global es la que de verdad aplica a la operación diaria de Del Campo. Esto además **encaja de forma natural con algo que el sistema ya tiene**: el cierre de caja (arqueo). El punto de enganche técnico más obvio, cuando llegue el momento, es que cerrar una caja (o un periodo) sea lo que dispare la generación de la factura global correspondiente -- no una pantalla nueva y separada.

## Qué necesita el NEGOCIO antes que nada (esto no lo resuelve Sunname)

Para poder timbrar cualquier CFDI, el negocio (Del Campo) necesita, dado de alta ante el SAT:

- RFC vigente.
- Régimen fiscal registrado (ej. RESICO, Régimen General, etc. -- lo determina su situación fiscal real, no el sistema).
- **CSD (Certificado de Sello Digital) vigente**, obtenido con su e.firma directamente en el portal del SAT.

Esto es trabajo del dueño (probablemente con ayuda de su contador), no de Sunname ni de ningún PAC -- ningún proveedor de facturación puede saltarse este paso. Vale la pena confirmar con el dueño si ya tiene esto resuelto, porque **es lo que de verdad determina el timeline de Fase 4**, no la parte técnica (que es relativamente rápida hoy con un PAC moderno).

## Qué cambiaría en el modelo de datos de Sunname (cuando llegue el momento)

- **`tenant_settings`**: agregar RFC del negocio, régimen fiscal, y código postal del "lugar de expedición" (domicilio fiscal).
- **`customers`** (CRM): agregar RFC, régimen fiscal, uso de CFDI y código postal fiscal -- pero solo se necesitan si un cliente pide factura individual; no hacen falta para la factura global.
- **`products`**: cada producto necesita una **clave de producto/servicio** (catálogo `c_ClaveProdServ` del SAT) y una **clave de unidad** (`c_ClaveUnidad`) -- esto sí toca el Catálogo/Unidades que ya existen. El catálogo del SAT se actualiza periódicamente (en 2026 hubo una actualización grande, 847 claves nuevas en enero) -- el PAC normalmente ya trae el catálogo vigente integrado, no hay que mantenerlo a mano.
- **Compatibilidad régimen↔uso**: el régimen fiscal del receptor debe ser compatible con el uso de CFDI elegido (catálogo `c_UsoCFDI`) -- si no, el PAC rechaza el timbrado. Para la factura global esto ya viene resuelto (régimen "616 - Sin obligaciones fiscales", uso "S01 - Sin efectos fiscales").

## Integración técnica: un PAC vía API, no conexión directa al SAT

Ningún negocio se conecta directo al SAT para timbrar -- siempre es a través de un **PAC** (Proveedor Autorizado de Certificación), que sella el CFDI con el CSD del negocio y lo registra ante el SAT. Para un sistema a la medida como Sunname (§8, "a la medida, independiente de Odoo"), lo que importa es qué tan buena es la API del PAC, no su interfaz web.

**Facturapi.io** destaca como la opción más orientada a desarrolladores -- API REST moderna (se describe como "Stripe, pero para CFDI"), SDKs en varios lenguajes, soporta multi-RFC (relevante si algún día hay más de un tenant facturando). Costo real (2026): ~$299 MXN/mes de suscripción + $0.60 MXN por CFDI timbrado -- accesible para un negocio del tamaño de Del Campo, y sin compromiso grande si Fase 4 se retrasa. Alternativas con API también: Facturama, SW Sapien, Fiscalapi.

No hace falta decidir el proveedor todavía -- la mayoría ofrece pruebas gratuitas de sandbox, así que la evaluación real puede esperar a que Fase 4 esté más cerca.

## Recomendación

No construir nada de esto ahora -- seguimos en Fase 1-2, un solo tenant, sin necesidad fiscal reportada todavía. Cuando se acerque el momento de Fase 4, el primer paso no es técnico: es confirmar con el dueño de Del Campo si ya tiene RFC, régimen fiscal y CSD vigentes ante el SAT. Eso determina si Fase 4 se puede empezar de inmediato o si primero hay un trámite fiscal pendiente del lado del negocio.

Sources:
- [CFDI 4.0 en 2026: requisitos y cómo emitirlo](https://blog.alegra.com/mexico/que-es-cfdi-4-0/)
- [Anexo 20 SAT 2026: guía completa de llenado del CFDI 4.0](https://siemprealdia.co/mexico/fiscal/anexo-20-sat-cfdi-4-0/)
- [Catálogos CFDI 4.0 Actualizados 2026](https://idnube.com/blog/actualizacion-catalogos-cfdi-4-0-2026)
- [Factura global - Factura al RFC Genérico XAXX010101000 CFDI 4.0](https://factura.com/ayuda/factura-global-factura-al-rfc-generico-cfdi-4-0/)
- [Factura Global: Ventas al Público en General [Guía SAT 2026]](https://senhub.mx/blog/factura-global-ventas-publico-general)
- [Los mejores 7 PACs de facturación en México para desarrolladores](https://gogl92.medium.com/los-mejores-7-pacs-de-facturaci%C3%B3n-en-m%C3%A9xico-para-desarrolladores-7f2e643a30c2)
- [Facturapi.io — Plataforma y API de Facturación Electrónica](https://www.facturapi.io/)
- [Información general sobre precios — Facturapi](https://help.facturapi.io/es/articles/9247074-informacion-general-sobre-precios)
