# Runbook de recuperación — base de datos de un negocio

> Para cuándo usar esto: la base de datos real de un negocio (ej. Del Campo) se corrompió, se borró por error, o el proyecto de Supabase quedó inutilizable. **No es para corregir un error de captura puntual** (un precio mal cargado, una venta equivocada) — eso se arregla desde la UI normal (Editar producto, Anular venta).

Este proceso se probó de extremo a extremo el 2026-09-01 contra el proyecto de desarrollo (`sunname-delcampo-dev`), incluyendo el punto más delicado: qué pasa con los usuarios. Lo que sigue es lo que en verdad funcionó, no un procedimiento teórico.

## 0. Antes de reconstruir nada a mano

Supabase puede tener respaldo nativo o *point-in-time recovery* a nivel de todo el proyecto, dependiendo del plan contratado — eso incluiría `auth.users` completo (contraseñas y todo) y sería muchísimo más simple que este runbook. **Revisar primero el dashboard de Supabase → el proyecto afectado → Database → Backups**, antes de asumir que hay que reconstruir todo desde el respaldo semanal propio. Este runbook es el plan de respaldo para cuando eso no está disponible o no alcanza (ej. plan gratuito, o el proyecto completo desapareció).

## 1. Qué respalda `backup.yml` y qué NO

El workflow `.github/workflows/backup.yml` corre cada lunes (y se puede disparar a mano: `gh workflow run backup.yml`) y sube dos archivos como artifact de GitHub Actions (retención 90 días):

- `schema.sql` — tablas, funciones, políticas de RLS, triggers. Todo el esquema `public`.
- `data.sql` — los datos reales: productos, ventas, movimientos de inventario, clientes, `profiles`, etc.

**Lo que NO incluye: el esquema `auth` de Supabase.** Ahí viven los usuarios reales — su email, su contraseña (hasheada), si confirmaron su correo. `profiles.id` es una llave foránea a `auth.users.id`, así que **restaurar `data.sql` en un proyecto nuevo falla** con un error de llave foránea en la primera fila de `profiles`, porque esos usuarios no existen todavía ahí. Esto se confirmó en vivo, no es una suposición:

```
ERROR:  insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"
DETALLE:  Key (id)=(...) is not present in table "users".
```

## 2. Restaurar en un proyecto nuevo (paso a paso)

### 2.1 Crear el proyecto y aplicar el esquema real

No uses `schema.sql` del respaldo como fuente de verdad — puede tener hasta una semana de antigüedad. Las migraciones en `supabase/migrations/` del repo son la fuente de verdad real del esquema:

```
supabase projects create <nombre> --org-id <org> --region <region> --db-password <password-nuevo>
supabase db push --db-url "postgresql://postgres:<password-nuevo>@db.<ref-nuevo>.supabase.co:5432/postgres" --include-all --yes
```

### 2.2 Descargar el respaldo más reciente

```
gh run list --workflow=backup.yml --limit 1
gh run download <run-id>
```

### 2.3 Recrear cada usuario real en Auth — con el mismo id

Antes de tocar `data.sql`, revisa qué usuarios había (`SELECT id, full_name, role FROM profiles` en el `data.sql` descargado, o pídeselo a quien tenga acceso al proyecto viejo si todavía responde). Por cada uno, créalo en el proyecto nuevo **especificando el mismo `id`** que tenía — la API de administración de Supabase Auth sí lo permite:

```bash
curl -X POST "https://<ref-nuevo>.supabase.co/auth/v1/admin/users" \
  -H "apikey: <service_role_key>" -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"id":"<id-original>","email":"<email-real>","password":"<temporal-al-azar>","email_confirm":true}'
```

Esto dispara `handle_new_user()` y crea automáticamente una fila en `profiles` con rol `cashier` (a propósito — ver auditoría de seguridad 2026-08-20, nunca confía en metadatos del signup). Es normal, el siguiente paso la corrige. Después de crear a todos, mándale a cada quien un link de "restablecer contraseña" — la contraseña original nunca se recupera (ni debería: ni siquiera un `pg_dump` del esquema `auth` la expondría en texto plano).

### 2.4 Restaurar `data.sql`

Aplícalo tal cual, **excepto el bloque `INSERT INTO "public"."profiles"`**, que hay que convertir a upsert (porque el paso anterior ya creó esas filas con rol `cashier`):

```sql
INSERT INTO public.profiles (id, full_name, role, active, created_at, updated_at) VALUES
  (...)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
```

El resto de las tablas (`products`, `sales`, `inventory_movements`, `customers`, etc.) no tiene este problema — restaura directo con `psql -f data.sql` (con el bloque de `profiles` ya corregido) o `supabase db push` según corresponda.

### 2.5 Verificar antes de dar por buena la recuperación

- Cada usuario real puede iniciar sesión (con la contraseña que acaba de restablecer) y ve su rol correcto.
- El conteo de productos/ventas/clientes coincide con lo esperado (compara contra Reportes si hay una captura reciente, o contra lo que recuerde el dueño).
- `tenant_settings` tiene el nombre real del negocio, no el default `'Mi Negocio'`.

### 2.6 Apuntar el sistema al proyecto nuevo

Si el `project ref` cambió (proyecto nuevo, no el mismo recuperado in-place):

- Actualiza los GitHub secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (usados por `deploy` en CI).
- Actualiza `SUPABASE_DB_PASSWORD` si también cambió, usado por `backup.yml` y `migration-check`.
- Redeploy (`git push` a `main`, o re-correr el workflow de deploy).
