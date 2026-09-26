-- Un mismo bloqueo serializa ventas, pagos, anulaciones y cierre.
-- El bloqueo dura toda la transacción, incluidos inventario y pagos de create_sale.
create function public.lock_sale_cash_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status cash_session_status;
begin
  if tg_table_name = 'sales' then
    if tg_op = 'UPDATE' and new.cash_session_id is distinct from old.cash_session_id then
      raise exception 'No se puede cambiar la caja de una venta';
    end if;
    v_id := case when tg_op = 'DELETE' then old.cash_session_id else new.cash_session_id end;
  else
    if tg_op = 'UPDATE' and new.sale_id is distinct from old.sale_id then
      raise exception 'No se puede cambiar la venta de un pago';
    end if;
    select cash_session_id into v_id from sales
      where id = case when tg_op = 'DELETE' then old.sale_id else new.sale_id end;
  end if;
  select status into v_status from cash_sessions where id = v_id for update;
  if not found then raise exception 'Caja no encontrada'; end if;
  -- Anular ventas históricas sigue permitido; agregar ventas o alterar pagos
  -- después de cerrar no lo está, tampoco desde la API de tablas.
  if v_status <> 'open' and (tg_table_name = 'sale_payments' or tg_op = 'INSERT') then
    raise exception 'La caja ya está cerrada. Actualiza la pantalla antes de continuar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.lock_sale_cash_session() from public;
create trigger sales_lock_cash_session before insert or update or delete on public.sales
  for each row execute function public.lock_sale_cash_session();
create trigger payments_lock_cash_session before insert or update or delete on public.sale_payments
  for each row execute function public.lock_sale_cash_session();

create function public.close_cash_session(
  p_session_id uuid, p_closing_amount numeric, p_expected_amount numeric, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_session cash_sessions%rowtype; v_expected numeric; v_role user_role;
begin
  v_role := current_role_key();
  if auth.uid() is null or v_role is null or v_role not in ('owner','local_admin','cashier') then
    raise exception 'No autorizado para cerrar caja';
  end if;
  if p_closing_amount is null or not (p_closing_amount >= 0 and p_closing_amount < 10000000000)
     or p_closing_amount <> round(p_closing_amount,2) then
    raise exception 'El efectivo contado debe ser un importe válido en centavos';
  end if;
  select * into v_session from cash_sessions where id=p_session_id for update;
  if not found then raise exception 'Caja no encontrada'; end if;
  if v_role='cashier' and v_session.opened_by <> auth.uid() then
    raise exception 'Solo puedes cerrar la caja abierta a tu nombre';
  end if;
  if v_session.status='closed' then
    if v_session.closed_by=auth.uid() and v_session.closing_amount=p_closing_amount
      and v_session.notes is not distinct from nullif(btrim(p_notes),'') then return v_session.id; end if;
    raise exception 'Esta caja ya fue cerrada. Actualiza la pantalla';
  end if;
  select expected_amount into v_expected from cash_session_balances where id=p_session_id;
  if p_expected_amount is distinct from v_expected then
    raise exception 'El efectivo esperado cambió. Actualiza el resumen y vuelve a revisar el cierre';
  end if;
  if p_closing_amount <> v_expected and nullif(btrim(p_notes),'') is null then
    raise exception 'Escribe una observación para explicar el descuadre';
  end if;
  update cash_sessions set status='closed',closed_at=now(),closed_by=auth.uid(),
    closing_amount=p_closing_amount,notes=nullif(btrim(p_notes),'') where id=p_session_id;
  return p_session_id;
end $$;
revoke all on function public.close_cash_session(uuid,numeric,numeric,text) from public;
grant execute on function public.close_cash_session(uuid,numeric,numeric,text) to authenticated;
-- El cierre solo puede pasar por la validación transaccional anterior.
revoke update on public.cash_sessions from authenticated;

-- Crear una orden y sus líneas es una sola transacción. UUID estable para reintentos.
alter table public.purchase_orders add column client_uuid uuid unique;
create function public.create_purchase_order(
  p_client_uuid uuid, p_supplier_id uuid, p_items jsonb,
  p_notes text default null, p_ticket_date date default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_item jsonb; v_quantity numeric(12,3); v_cost numeric(12,2); v_role user_role;
begin
  v_role := current_role_key();
  if auth.uid() is null or v_role is null or v_role not in ('owner','local_admin') then
    raise exception 'No autorizado para crear compras';
  end if;
  if p_client_uuid is null then raise exception 'Falta el identificador de la solicitud'; end if;
  -- Serializa incluso dos peticiones simultáneas del mismo UUID.
  perform pg_advisory_xact_lock(hashtextextended(p_client_uuid::text,0));
  select id into v_id from purchase_orders where client_uuid=p_client_uuid and created_by=auth.uid();
  if found then return v_id; end if;
  if not exists(select 1 from suppliers where id=p_supplier_id and active) then raise exception 'Selecciona un proveedor activo'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'La orden necesita productos'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'La orden necesita productos'; end if;
  insert into purchase_orders(supplier_id,status,notes,created_by,ticket_date,client_uuid)
    values(p_supplier_id,'ordered',p_notes,auth.uid(),p_ticket_date,p_client_uuid) returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::numeric;
    v_cost := (v_item->>'unit_cost')::numeric;
    if v_quantity is null or not (v_quantity > 0 and v_quantity < 1000000000)
       or v_cost is null or not (v_cost >= 0 and v_cost < 10000000000) then raise exception 'Cantidad o costo inválido'; end if;
    if not exists(select 1 from products where id=(v_item->>'product_id')::uuid and active) then raise exception 'Producto no disponible'; end if;
    insert into purchase_order_items(purchase_order_id,product_id,quantity,unit_cost,subtotal)
      values(v_id,(v_item->>'product_id')::uuid,v_quantity,v_cost,round(v_quantity*v_cost,2));
  end loop;
  return v_id;
end $$;
revoke all on function public.create_purchase_order(uuid,uuid,jsonb,text,date) from public;
grant execute on function public.create_purchase_order(uuid,uuid,jsonb,text,date) to authenticated;

-- Reimpresiones nuevas conservan nombre y unidad de venta. Para ventas anteriores
-- no existe un nombre histórico: se usa el nombre actual como referencia inicial.
alter table public.sale_items add column product_name text;
alter table public.sale_items add column sold_by_weight boolean;
update public.sale_items si set product_name=p.name,sold_by_weight=p.sold_by_weight
  from public.products p where p.id=si.product_id;
create function public.snapshot_sale_item() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  select name,sold_by_weight into new.product_name,new.sold_by_weight from products where id=new.product_id;
  return new;
end $$;
revoke all on function public.snapshot_sale_item() from public;
create trigger sale_items_snapshot before insert on public.sale_items
  for each row execute function public.snapshot_sale_item();

-- Índices para paginar historial y filtrar tickets sin cargar todas las ventas.
create index inventory_movements_product_history_idx on public.inventory_movements(product_id,created_at desc,id desc);
create index sales_created_at_idx on public.sales(created_at desc,id desc);
