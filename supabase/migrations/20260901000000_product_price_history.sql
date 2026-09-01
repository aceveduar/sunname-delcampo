-- Bitácora inmutable de cambios de precio (mismo patrón que
-- inventory_movements: solo insert, nunca update/delete). El objetivo no
-- es una función grande de repricing todavía -- es tener datos reales de
-- qué tan seguido cambia el precio de cada producto antes de diseñar
-- algo más grande (CLAUDE.md, decisión de precios 2026-09-01: falta una
-- plática a fondo con el dueño de Del Campo para aterrizar cantidades y
-- frecuencia real).

create table product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  old_price numeric(12, 2),
  new_price numeric(12, 2) not null,
  old_price_per_100g numeric(12, 2),
  new_price_per_100g numeric(12, 2),
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

comment on table product_price_history is 'Bitácora inmutable de cambios de precio -- alimentada solo por el trigger de products, nunca por insert directo.';

create index product_price_history_product_id_idx on product_price_history (product_id, changed_at desc);

-- security definer: quien cambia un precio (owner/local_admin, ya
-- filtrado por products_write) no tiene por qué tener grant directo de
-- insert sobre la bitácora -- igual que create_sale con
-- inventory_movements, el trigger es el único camino de escritura.
create function log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.price is distinct from old.price
    or new.price_per_100g is distinct from old.price_per_100g
  then
    insert into product_price_history (
      product_id, old_price, new_price, old_price_per_100g, new_price_per_100g, changed_by
    )
    values (old.id, old.price, new.price, old.price_per_100g, new.price_per_100g, auth.uid());
  end if;
  return new;
end;
$$;

create trigger products_log_price_change
  after update on products
  for each row execute function log_price_change();

alter table product_price_history enable row level security;

create policy product_price_history_select on product_price_history for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));

grant select on product_price_history to authenticated;
grant select on product_price_history to service_role;
