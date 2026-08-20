-- Sunname ERP — esquema inicial (Fase 1: catálogo, inventario, caja)
--
-- Modelo de multi-tenencia: una base de datos por negocio (CLAUDE.md §8).
-- Por eso no hay tabla `tenants` ni columna `tenant_id`: el aislamiento
-- entre negocios lo da la base de datos misma, no una fila. Si en Fase 3
-- se evalúa migrar a un esquema compartido con RLS por tenant, este mismo
-- modelo de datos es el punto de partida (solo se añadiría tenant_id).

create extension if not exists pgcrypto;

-- ── Helpers ──────────────────────────────────────────────────────────────

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Roles y usuarios (CLAUDE.md §6) ────────────────────────────────────────
-- accountant y granularidad multi-local llegan en fases posteriores; el
-- enum puede crecer con ALTER TYPE ... ADD VALUE sin romper lo existente.

create type user_role as enum (
  'owner',
  'local_admin',
  'cashier',
  'accountant',
  'viewer'
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role user_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Perfil y rol de cada usuario de este negocio (1 fila por auth.users).';

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Rol del usuario autenticado actual. security definer + search_path fijo
-- para poder leer profiles desde dentro de las policies de RLS sin recursión.
create function current_role_key()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- Alta automática de perfil al crear un usuario en Supabase Auth (invitación
-- desde el panel de administración de usuarios de la app).
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'cashier')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Módulos activos del negocio ─────────────────────────────────────────
-- Mismo mecanismo previsto en CLAUDE.md §5.1 y §11: qué paquete de
-- módulos tiene contratado/activo este negocio.

create table tenant_modules (
  module_key text primary key,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table tenant_modules is 'Módulos (caja, inventario, crm, compras, facturación) activos en este negocio.';

create trigger tenant_modules_set_updated_at
  before update on tenant_modules
  for each row execute function set_updated_at();

insert into tenant_modules (module_key, enabled) values
  ('catalog', true),
  ('inventory', true),
  ('cash', true),
  ('crm', false),
  ('purchasing', false),
  ('billing', false);

-- ── Catálogo (productos) ────────────────────────────────────────────────
-- Solo productos por ahora: el modelo de servicios se aborda después
-- (CLAUDE.md §13, pospuesto deliberadamente).

create table units_of_measure (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references product_categories (id) on delete set null,
  active boolean not null default true
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  description text,
  category_id uuid references product_categories (id) on delete set null,
  unit_id uuid not null references units_of_measure (id),
  price numeric(12, 2) not null default 0 check (price >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  track_inventory boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on products (category_id);
create index products_active_idx on products (active) where active;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ── Inventario ───────────────────────────────────────────────────────────

create type inventory_movement_type as enum ('in', 'out', 'adjustment');

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete restrict,
  type inventory_movement_type not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index inventory_movements_product_id_idx on inventory_movements (product_id);

-- Existencia actual como vista sobre los movimientos, para no mantener un
-- saldo duplicado que se pueda desincronizar de su historial.
create view inventory_stock as
select
  product_id,
  coalesce(sum(case
    when type = 'in' then quantity
    when type = 'out' then -quantity
    when type = 'adjustment' then quantity
  end), 0) as quantity_on_hand
from inventory_movements
group by product_id;

-- ── Caja ─────────────────────────────────────────────────────────────────
-- Un solo local para el MVP (CLAUDE.md §4 Fase 1): el índice único parcial
-- de abajo asume una sola caja abierta a la vez. Al llegar multi-local
-- (Fase 3) se agrega location_id y se ajusta ese índice.

create type cash_session_status as enum ('open', 'closed');

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references profiles (id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(12, 2) not null default 0,
  closed_by uuid references profiles (id),
  closed_at timestamptz,
  closing_amount numeric(12, 2),
  status cash_session_status not null default 'open',
  notes text
);

create unique index cash_sessions_single_open_idx on cash_sessions (status) where status = 'open';

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);

insert into payment_methods (code, name) values
  ('cash', 'Efectivo'),
  ('card', 'Tarjeta'),
  ('transfer', 'Transferencia');

create type sale_status as enum ('completed', 'voided');

create table sales (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null unique,
  cash_session_id uuid not null references cash_sessions (id),
  sold_by uuid not null references profiles (id),
  status sale_status not null default 'completed',
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

comment on column sales.client_uuid is 'UUID generado en el dispositivo (cola local de caja) para deduplicar reintentos de sincronización tras un corte de conexión — CLAUDE.md §2.';

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null
);

create index sale_items_sale_id_idx on sale_items (sale_id);

create table sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  payment_method_id uuid not null references payment_methods (id),
  amount numeric(12, 2) not null check (amount > 0)
);

create index sale_payments_sale_id_idx on sale_payments (sale_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Todo requiere sesión autenticada; el detalle fino de quién puede tocar
-- qué (precios/costos vs. solo vender) se resuelve por rol.

alter table profiles enable row level security;
alter table tenant_modules enable row level security;
alter table units_of_measure enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table inventory_movements enable row level security;
alter table cash_sessions enable row level security;
alter table payment_methods enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table sale_payments enable row level security;

-- profiles
create policy profiles_select on profiles for select
  to authenticated
  using (id = auth.uid() or current_role_key() in ('owner', 'local_admin'));

create policy profiles_update_self on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_manage_admin on profiles for all
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

-- tenant_modules
create policy tenant_modules_select on tenant_modules for select
  to authenticated using (true);

create policy tenant_modules_write on tenant_modules for all
  to authenticated
  using (current_role_key() = 'owner')
  with check (current_role_key() = 'owner');

-- catálogo: lectura abierta a autenticados, escritura solo admin+
create policy units_of_measure_select on units_of_measure for select to authenticated using (true);
create policy units_of_measure_write on units_of_measure for all to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

create policy product_categories_select on product_categories for select to authenticated using (true);
create policy product_categories_write on product_categories for all to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

create policy products_select on products for select to authenticated using (true);
create policy products_write on products for all to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

-- inventario: cajero solo puede insertar salidas ligadas a una venta;
-- entradas/ajustes libres quedan para admin+.
create policy inventory_movements_select on inventory_movements for select to authenticated using (true);
create policy inventory_movements_insert on inventory_movements for insert to authenticated
  with check (
    current_role_key() in ('owner', 'local_admin')
    or (current_role_key() = 'cashier' and type = 'out' and reference_type = 'sale')
  );

-- caja: cajero abre/opera su propio turno; admin+ ve y gestiona todo.
create policy cash_sessions_select on cash_sessions for select to authenticated using (true);
create policy cash_sessions_insert on cash_sessions for insert to authenticated
  with check (current_role_key() in ('owner', 'local_admin', 'cashier'));
create policy cash_sessions_update on cash_sessions for update to authenticated
  using (
    current_role_key() in ('owner', 'local_admin')
    or (current_role_key() = 'cashier' and opened_by = auth.uid())
  );

create policy payment_methods_select on payment_methods for select to authenticated using (true);
create policy payment_methods_write on payment_methods for all to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

create policy sales_select on sales for select to authenticated using (true);
create policy sales_insert on sales for insert to authenticated
  with check (current_role_key() in ('owner', 'local_admin', 'cashier'));

create policy sale_items_select on sale_items for select to authenticated using (true);
create policy sale_items_insert on sale_items for insert to authenticated
  with check (current_role_key() in ('owner', 'local_admin', 'cashier'));

create policy sale_payments_select on sale_payments for select to authenticated using (true);
create policy sale_payments_insert on sale_payments for insert to authenticated
  with check (current_role_key() in ('owner', 'local_admin', 'cashier'));
