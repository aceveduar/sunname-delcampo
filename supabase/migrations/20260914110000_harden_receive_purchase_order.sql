-- Cierra el hallazgo Alto de la auditoría técnica (2026-09-13): dos
-- huecos relacionados en Compras.
--
-- 1. purchase_orders_update no restringía qué columnas se pueden
--    cambiar -- cualquier owner/local_admin podía hacer
--    PATCH /purchase_orders {"status":"received"} directo, sin pasar
--    por receive_purchase_order(), dejando la orden "recibida" sin que
--    se muevan ni el inventario ni el costo del catálogo. El resto de
--    transiciones sensibles (sales, inventory_movements) ya quedaron
--    bloqueadas a solo-función desde el endurecimiento de agosto;
--    purchase_orders nunca recibió el mismo candado.
--
-- 2. receive_purchase_order() era la única función privilegiada sin el
--    patrón "security definer + verificación de rol explícita" que ya
--    usan create_sale/void_sale/delete_product/request_global_invoice
--    -- dependía por completo del RLS de purchase_orders/
--    inventory_movements/products para mantener fuera a un cajero.

drop policy purchase_orders_update on purchase_orders;
create policy purchase_orders_update on purchase_orders for update
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (
    current_role_key() in ('owner', 'local_admin')
    and status is distinct from 'received'
  );

create or replace function receive_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_status purchase_order_status;
  v_item record;
begin
  v_caller_role := current_role_key();
  if v_caller_role not in ('owner', 'local_admin') then
    raise exception 'No autorizado para recibir órdenes de compra';
  end if;

  select status into v_status from purchase_orders where id = p_purchase_order_id;

  if v_status is null then
    raise exception 'Orden de compra no encontrada';
  end if;

  if v_status <> 'ordered' then
    raise exception 'Solo se puede recibir una orden en estado "ordered" (está en "%")', v_status;
  end if;

  for v_item in
    select product_id, quantity, unit_cost from purchase_order_items where purchase_order_id = p_purchase_order_id
  loop
    insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, created_by)
    values (v_item.product_id, 'in', v_item.quantity, 'purchase', p_purchase_order_id, auth.uid());

    -- El costo del catálogo se queda con el de esta compra. Se ignora un
    -- unit_cost en cero: significa que no se capturó, no que el producto
    -- sea gratis, y sobrescribir con cero borraría el costo anterior.
    if v_item.unit_cost > 0 then
      update products set cost = v_item.unit_cost where id = v_item.product_id;
    end if;
  end loop;

  update purchase_orders
  set status = 'received', received_by = auth.uid(), received_at = now()
  where id = p_purchase_order_id;
end;
$$;

grant execute on function receive_purchase_order(uuid) to authenticated;
