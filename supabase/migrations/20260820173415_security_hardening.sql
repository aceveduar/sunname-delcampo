-- Auditoría de seguridad (2026-08-20). Cierra hallazgos confirmados
-- contra el proyecto real, verificados con pruebas concretas antes de
-- escribir esta migración (no son teóricos):
--
-- 1. CRÍTICO: handle_new_user() confiaba en raw_user_meta_data->>'role'.
--    Con auth.enable_signup activo por default, cualquiera podía
--    autorregistrarse como 'owner' sin autenticarse, vía
--    POST /auth/v1/signup con la anon key. Probado en vivo y revertido.
-- 2. ALTO: profiles_update_self dejaba a cualquier usuario cambiarse su
--    propio rol/estado (política adicional a profiles_manage_admin;
--    Postgres solo exige pasar UNA política permissive, no todas).
-- 3. ALTO: create_sale confiaba en unit_price del cliente -- un cajero
--    podía registrar una venta a precio inventado y quedarse con la
--    diferencia en efectivo real cobrada al cliente.
-- 4. MEDIO: create_sale no validaba que la caja indicada estuviera
--    abierta a nombre de quien llama.
-- 5. ALTO: un cajero podía insertar movimientos de inventario 'out'
--    con reference_id inventado, sin que existiera una venta real --
--    permite encubrir robo de mercancía física.
-- 6. MEDIO: sale_items/sale_payments se podían insertar sobre ventas
--    ajenas (a diferencia de sales, que sí exige sold_by = auth.uid()).
--
-- Fix arquitectónico para 3/4/5/6: create_sale pasa a SECURITY DEFINER
-- con toda su autorización explícita adentro (antes dependía de RLS de
-- las tablas que toca); esas tablas dejan de aceptar escritura directa
-- de cajeros -- todo venta pasa por esta función, sin atajos.

-- ── 1. Alta automática nunca hereda el rol de los metadatos ─────────
create or replace function handle_new_user()
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
    'cashier'
  );
  return new;
end;
$$;

-- ── 2. Nadie puede cambiarse su propio rol/estado activo ─────────────
create function prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and current_role_key() not in ('owner', 'local_admin') then
    raise exception 'No puedes cambiar tu propio rol o estado activo';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ── 3/4/5/6. create_sale: autorización explícita, precio y caja del
-- servidor, todo o nada, security definer ───────────────────────────
drop function create_sale(uuid, uuid, jsonb, jsonb, uuid);

create function create_sale(
  p_client_uuid uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_sale_id uuid;
  v_subtotal numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_item jsonb;
  v_payment jsonb;
  v_product_id uuid;
  v_quantity numeric(12, 3);
  v_unit_price numeric(12, 2);
begin
  v_caller_role := current_role_key();
  if v_caller_role not in ('owner', 'local_admin', 'cashier') then
    raise exception 'No autorizado para registrar ventas';
  end if;

  if v_caller_role = 'cashier' and not exists (
    select 1 from cash_sessions
    where id = p_cash_session_id and status = 'open' and opened_by = auth.uid()
  ) then
    raise exception 'La caja indicada no está abierta a tu nombre';
  end if;

  select coalesce(sum((payment ->> 'amount')::numeric), 0)
  into v_total
  from jsonb_array_elements(p_payments) as payment;

  insert into sales (client_uuid, cash_session_id, sold_by, customer_id, subtotal, total)
  values (p_client_uuid, p_cash_session_id, auth.uid(), p_customer_id, 0, v_total)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;

    -- El precio SIEMPRE viene del catálogo, nunca de lo que mande el
    -- cliente -- es la unica forma de que "unit_price" sea confiable.
    select price into v_unit_price from products where id = v_product_id;
    if v_unit_price is null then
      raise exception 'Producto % no encontrado', v_product_id;
    end if;

    insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_quantity, v_unit_price, v_quantity * v_unit_price);

    v_subtotal := v_subtotal + v_quantity * v_unit_price;

    insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, created_by)
    select v_product_id, 'out', v_quantity, 'sale', v_sale_id, auth.uid()
    where coalesce((select track_inventory from products where id = v_product_id), false);
  end loop;

  if v_total <> v_subtotal then
    raise exception 'Los pagos (%) no coinciden con el subtotal de la venta (%)', v_total, v_subtotal;
  end if;

  update sales set subtotal = v_subtotal where id = v_sale_id;

  for v_payment in select * from jsonb_array_elements(p_payments)
  loop
    insert into sale_payments (sale_id, payment_method_id, amount)
    values (v_sale_id, (v_payment ->> 'payment_method_id')::uuid, (v_payment ->> 'amount')::numeric);
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function create_sale(uuid, uuid, jsonb, jsonb, uuid) to authenticated;

-- Ya no hay atajo: toda escritura en estas tablas pasa por create_sale
-- (security definer) o por un owner/local_admin corrigiendo a mano.
drop policy sales_insert on sales;
create policy sales_insert on sales for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin'));

drop policy sale_items_insert on sale_items;
create policy sale_items_insert on sale_items for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin'));

drop policy sale_payments_insert on sale_payments;
create policy sale_payments_insert on sale_payments for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin'));

drop policy inventory_movements_insert on inventory_movements;
create policy inventory_movements_insert on inventory_movements for insert
  to authenticated
  with check (current_role_key() in ('owner', 'local_admin'));
