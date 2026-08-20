-- Compras básicas (CLAUDE.md §4, Fase 2): proveedores y órdenes de
-- compra. Recibir una orden genera movimientos de entrada en
-- inventory_movements (reference_type='purchase'), igual patrón que
-- create_sale para las ventas: todo o nada, vía función.
--
-- Solo owner/local_admin tocan compras -- un cajero no debe ver costos
-- ni proveedores (CLAUDE.md §6).

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type purchase_order_status as enum ('draft', 'ordered', 'received', 'cancelled');

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete restrict,
  status purchase_order_status not null default 'draft',
  notes text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  received_by uuid references profiles (id),
  received_at timestamptz
);

create index purchase_orders_supplier_id_idx on purchase_orders (supplier_id);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  subtotal numeric(12, 2) not null
);

create index purchase_order_items_purchase_order_id_idx on purchase_order_items (purchase_order_id);

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy suppliers_select on suppliers for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));
create policy suppliers_write on suppliers for all
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

create policy purchase_orders_select on purchase_orders for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));
create policy purchase_orders_insert on purchase_orders for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin') and created_by = auth.uid());
create policy purchase_orders_update on purchase_orders for update
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

create policy purchase_order_items_select on purchase_order_items for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));
create policy purchase_order_items_insert on purchase_order_items for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin'));
create policy purchase_order_items_delete on purchase_order_items for delete
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'));

-- ── Grants ───────────────────────────────────────────────────────────────
-- Explícito además del ALTER DEFAULT PRIVILEGES ya aplicado, por la misma
-- razón que ya nos mordió una vez: RLS no sirve de nada sin el GRANT base.
grant select, insert, update, delete on suppliers, purchase_orders, purchase_order_items to authenticated;

-- ── Recepción de una orden: entradas de inventario + estado, atómico ─────
create or replace function receive_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_status purchase_order_status;
  v_item record;
begin
  select status into v_status from purchase_orders where id = p_purchase_order_id;

  if v_status is null then
    raise exception 'Orden de compra no encontrada';
  end if;

  if v_status <> 'ordered' then
    raise exception 'Solo se puede recibir una orden en estado "ordered" (está en "%")', v_status;
  end if;

  for v_item in
    select product_id, quantity from purchase_order_items where purchase_order_id = p_purchase_order_id
  loop
    insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, created_by)
    values (v_item.product_id, 'in', v_item.quantity, 'purchase', p_purchase_order_id, auth.uid());
  end loop;

  update purchase_orders
  set status = 'received', received_by = auth.uid(), received_at = now()
  where id = p_purchase_order_id;
end;
$$;

grant execute on function receive_purchase_order(uuid) to authenticated;

-- Ya no está deshabilitado en la config del negocio: el módulo existe.
update tenant_modules set enabled = true where module_key = 'purchasing';
