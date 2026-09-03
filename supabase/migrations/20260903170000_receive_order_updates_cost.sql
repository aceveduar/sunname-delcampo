-- Al recibir una orden de compra, actualizar también products.cost.
--
-- Hueco real detectado al analizar los tickets de proveedor
-- (docs/captura-tickets-analisis.md §11): receive_purchase_order
-- registraba unit_cost en la orden y movía el inventario, pero nunca
-- tocaba products.cost -- o sea que recibir mercancía a un precio nuevo
-- dejaba el costo del catálogo desactualizado, y con él el margen que
-- muestra Reportes. Aplica a TODA orden de compra, no solo a las
-- capturadas por foto.
--
-- Se usa el costo de la última compra, no un promedio ponderado. Es una
-- elección deliberada: el promedio ponderado necesita saber cuánto
-- stock viejo queda y a qué costo entró, y hoy no hay datos reales para
-- afinar eso. El dueño se surte en central de abastos a precio variable
-- y repone seguido, así que "lo que costó la última vez" es lo que él
-- mismo usa para decidir. Si más adelante hace falta el promedio
-- ponderado, se cambia aquí, en un solo lugar.

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
