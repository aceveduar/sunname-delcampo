alter table public.purchase_order_items add column received_quantity numeric(12,3) not null default 0
  check (received_quantity >= 0 and received_quantity <= quantity);
-- No se inventan entregas históricas: solo se inicializa el acumulado existente.
update public.purchase_order_items i set received_quantity=i.quantity
  from public.purchase_orders o where o.id=i.purchase_order_id and o.status='received';

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null unique,
  purchase_order_id uuid not null references public.purchase_orders(id),
  received_by uuid not null references public.profiles(id),
  actor_name text not null,
  created_at timestamptz not null default now(),
  notes text,
  items jsonb not null check (jsonb_typeof(items)='array'),
  request_items jsonb not null
);
create index purchase_receipts_order_history_idx on public.purchase_receipts(purchase_order_id,created_at desc,id desc);
alter table public.purchase_receipts enable row level security;
create policy purchase_receipts_read on public.purchase_receipts for select to authenticated
  using (public.current_role_key() in ('owner','local_admin'));
revoke all on public.purchase_receipts from anon, authenticated;
grant select on public.purchase_receipts to authenticated;
-- La creación y recepción transaccionales son las únicas escritoras de líneas.
revoke insert,update,delete on public.purchase_order_items from authenticated;
drop policy purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update on public.purchase_orders for update to authenticated
  using (current_role_key() in ('owner','local_admin'))
  with check (current_role_key() in ('owner','local_admin') and status is distinct from 'received');
create function public.prevent_received_order_reopen() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='received' and new.status is distinct from old.status then
    raise exception 'Una orden recibida no puede reabrirse';
  end if;
  return new;
end $$;
revoke all on function public.prevent_received_order_reopen() from public;
create trigger purchase_order_no_reopen before update on public.purchase_orders
  for each row execute function public.prevent_received_order_reopen();

create function public.receive_purchase_delivery(
  p_client_uuid uuid, p_purchase_order_id uuid, p_items jsonb, p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_role user_role := current_role_key();
  v_status purchase_order_status;
  v_previous purchase_receipts%rowtype;
  v_item purchase_order_items%rowtype;
  v_input jsonb;
  v_quantity numeric;
  v_request jsonb;
  v_snapshots jsonb := '[]';
  v_name text;
  v_id uuid;
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','local_admin') then
    raise exception 'No autorizado para recibir órdenes de compra';
  end if;
  if p_client_uuid is null then raise exception 'Falta el identificador de recepción'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Selecciona productos recibidos'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Selecciona productos recibidos'; end if;
  if length(p_notes)>1000 then raise exception 'La nota no puede superar 1000 caracteres'; end if;
  select jsonb_agg(jsonb_build_object('item_id',(x->>'item_id')::uuid,'quantity',(x->>'quantity')::numeric) order by (x->>'item_id')::uuid)
    into v_request from jsonb_array_elements(p_items) x;
  if (select count(*) <> count(distinct x->>'item_id') from jsonb_array_elements(v_request) x) then
    raise exception 'Cada producto debe aparecer una sola vez';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_uuid::text,0));
  select * into v_previous from purchase_receipts where client_uuid=p_client_uuid;
  if found then
    if v_previous.received_by=auth.uid() and v_previous.purchase_order_id=p_purchase_order_id
      and v_previous.request_items=v_request and v_previous.notes is not distinct from nullif(btrim(p_notes),'') then
      return v_previous.id;
    end if;
    raise exception 'Esta solicitud ya se utilizó con otros datos';
  end if;
  select status into v_status from purchase_orders where id=p_purchase_order_id for update;
  if not found then raise exception 'Orden de compra no encontrada'; end if;
  if v_status <> 'ordered' then raise exception 'Solo se puede recibir una orden en estado "ordered"'; end if;
  -- Bloqueo de productos en orden estable para evitar inversión entre entregas.
  perform p.id from products p join purchase_order_items i on i.product_id=p.id
    where i.purchase_order_id=p_purchase_order_id order by p.id for update of p;
  for v_input in select * from jsonb_array_elements(v_request) loop
    v_quantity := (v_input->>'quantity')::numeric;
    if v_quantity is null or not (v_quantity>0 and v_quantity<1000000000) or v_quantity<>round(v_quantity,3) then
      raise exception 'La cantidad debe ser positiva y tener hasta tres decimales';
    end if;
    select * into v_item from purchase_order_items
      where id=(v_input->>'item_id')::uuid and purchase_order_id=p_purchase_order_id for update;
    if not found then raise exception 'El producto no pertenece a esta orden'; end if;
    if v_quantity > v_item.quantity-v_item.received_quantity then
      raise exception 'La cantidad supera lo pendiente. Actualiza la orden';
    end if;
    select name into v_name from products where id=v_item.product_id;
    insert into inventory_movements(product_id,type,quantity,reference_type,reference_id,created_by)
      values(v_item.product_id,'in',v_quantity,'purchase',p_purchase_order_id,auth.uid());
    if v_item.unit_cost>0 then update products set cost=v_item.unit_cost where id=v_item.product_id; end if;
    update purchase_order_items set received_quantity=received_quantity+v_quantity where id=v_item.id;
    v_snapshots := v_snapshots || jsonb_build_array(jsonb_build_object(
      'item_id',v_item.id,'product_name',v_name,'quantity',v_quantity,'unit_cost',v_item.unit_cost));
  end loop;
  insert into purchase_receipts(client_uuid,purchase_order_id,received_by,actor_name,notes,items,request_items)
    values(p_client_uuid,p_purchase_order_id,auth.uid(),
      coalesce((select nullif(btrim(full_name),'') from profiles where id=auth.uid()),'Usuario'),
      nullif(btrim(p_notes),''),v_snapshots,v_request) returning id into v_id;
  if not exists(select 1 from purchase_order_items where purchase_order_id=p_purchase_order_id and received_quantity<quantity) then
    update purchase_orders set status='received',received_by=auth.uid(),received_at=now() where id=p_purchase_order_id;
  end if;
  return v_id;
end $$;
revoke all on function public.receive_purchase_delivery(uuid,uuid,jsonb,text) from public;
grant execute on function public.receive_purchase_delivery(uuid,uuid,jsonb,text) to authenticated;

-- Compatibilidad con terminales anteriores: recibir solo el remanente.
create or replace function public.receive_purchase_order(p_purchase_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_items jsonb; v_status purchase_order_status; v_role user_role := current_role_key();
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','local_admin') then
    raise exception 'No autorizado para recibir órdenes de compra';
  end if;
  select status into v_status from purchase_orders where id=p_purchase_order_id for update;
  if not found then raise exception 'Orden de compra no encontrada'; end if;
  if v_status <> 'ordered' then raise exception 'Solo se puede recibir una orden en estado "ordered"'; end if;
  select jsonb_agg(jsonb_build_object('item_id',id,'quantity',quantity-received_quantity)) into v_items
    from purchase_order_items where purchase_order_id=p_purchase_order_id and received_quantity<quantity;
  perform receive_purchase_delivery(gen_random_uuid(),p_purchase_order_id,coalesce(v_items,'[]'),null);
end $$;
revoke all on function public.receive_purchase_order(uuid) from public;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
