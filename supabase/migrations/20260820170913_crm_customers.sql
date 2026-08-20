-- CRM básico (CLAUDE.md §3, Fase 2): clientes, y poder ligar una venta
-- a uno de forma opcional -- el mostrador sin cliente identificado
-- sigue funcionando exactamente igual que hasta ahora.

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table sales add column customer_id uuid references customers (id);

alter table customers enable row level security;

-- A diferencia de proveedores/costos, un cliente no es información
-- sensible: cualquier cajero puede darlo de alta al momento de vender.
create policy customers_select on customers for select to authenticated using (true);
create policy customers_write on customers for all
  to authenticated
  using (current_role_key() in ('owner', 'local_admin', 'cashier'))
  with check (current_role_key() in ('owner', 'local_admin', 'cashier'));

grant select, insert, update, delete on customers to authenticated;

-- create_sale gana un p_customer_id opcional. Postgres trata un
-- parámetro nuevo como una firma distinta, así que hay que tirar la
-- versión anterior antes de crear la nueva (create or replace no basta
-- cuando cambia la lista de parámetros).
drop function create_sale(uuid, uuid, jsonb, jsonb);

create function create_sale(
  p_client_uuid uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_sale_id uuid;
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2);
  v_item jsonb;
  v_payment jsonb;
begin
  select coalesce(sum((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item;

  select coalesce(sum((payment ->> 'amount')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_payments) as payment;

  insert into sales (client_uuid, cash_session_id, sold_by, customer_id, subtotal, total)
  values (p_client_uuid, p_cash_session_id, auth.uid(), p_customer_id, v_subtotal, v_total)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (
      v_sale_id,
      (v_item ->> 'product_id')::uuid,
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric
    );

    insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, created_by)
    select (v_item ->> 'product_id')::uuid, 'out', (v_item ->> 'quantity')::numeric, 'sale', v_sale_id, auth.uid()
    where coalesce((select track_inventory from products where id = (v_item ->> 'product_id')::uuid), false);
  end loop;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    insert into sale_payments (sale_id, payment_method_id, amount)
    values (v_sale_id, (v_payment ->> 'payment_method_id')::uuid, (v_payment ->> 'amount')::numeric);
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function create_sale(uuid, uuid, jsonb, jsonb, uuid) to authenticated;

update tenant_modules set enabled = true where module_key = 'crm';
