# Estrategia de migraciones de base de datos

## El problema real, dado nuestro modelo

Sunname ERP usa **una base de datos por negocio** (§8 de CLAUDE.md), no un esquema compartido entre tenants. Eso cambia el problema de raíz frente al caso típico de un SaaS: no existe el riesgo de que una migración le pegue a todos los clientes a la vez por compartir tabla — cada negocio es su propio proyecto de Supabase, aislado.

Lo que sí sigue siendo un riesgo real, incluso con un solo tenant:

1. **No romper al negocio que ya está operando** en el momento exacto en que se aplica la migración (un cajero a media venta cuando cambia el esquema).
2. **Que el frontend desplegado y el esquema de la base no queden desincronizados** ni un segundo más de lo necesario.
3. Cuando exista un segundo o tercer tenant: **que no se desincronicen entre sí** sobre qué migración tiene cada quien.

## Regla para escribir migraciones seguras

Preferir cambios **aditivos primero, destructivos después, en una migración aparte**:

- Agregar una columna nueva → backfill si hace falta → hasta una migración posterior (cuando el frontend que la necesitaba ya lleva tiempo desplegado) quitar o volver `not null` lo viejo.
- Nunca combinar en un mismo paso "quitar/renombrar algo que el frontend ya desplegado todavía usa" -- eso sí puede romper al negocio en vivo, aunque solo haya un tenant.
- Un esquema nuevo con frontend viejo casi siempre falla mejor (el frontend simplemente ignora la columna/función nueva) que un frontend nuevo contra un esquema que todavía no existe.

## Orden de despliegue

**Migración a producción primero, frontend después.** Ya es la práctica real de este proyecto (`supabase db push --linked` a mano, luego `git push` dispara `deploy`); el job `migration-check` de CI (2026-09-01) ahora falla el build si alguien lo olvida, en vez de descubrirlo semanas después como pasó con el candado de `create_sale`.

## Cuando exista un segundo o tercer tenant (todavía no aplica)

Cada tenant sigue siendo su propio proyecto de Supabase -- la migración se aplica **una vez por tenant, nunca todas a la vez**:

1. Proyecto de desarrollo (`sunname-delcampo-dev` u otro) primero, siempre.
2. Un tenant de producción a la vez, no en paralelo -- verificar que el primero quedó bien antes de tocar el segundo. Si algo sale mal, se detecta con un solo negocio afectado, no con todos.
3. Registro de qué tenant tiene qué migración: por ahora, con un solo tenant, `supabase migration list --linked` contra cada proyecto alcanza. Con varios tenants reales esto se vuelve una tabla simple (nombre del negocio, project ref, última migración aplicada) -- **deliberadamente no se construye todavía**, sería resolver un problema sin tenants reales que lo tengan (mismo criterio que CLAUDE.md ya aplica en otras partes: no construir de más antes de tener evidencia real).

Ver también [`runbook-recuperacion.md`](./runbook-recuperacion.md) para el caso de recuperación completa de un tenant, que es un problema relacionado pero distinto (restaurar un negocio perdido, no desplegar un cambio de esquema a uno que sigue vivo).
