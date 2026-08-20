-- Registra una venta completa (venta + líneas + pagos + salida de
-- inventario) en una sola transacción. Se llama vía RPC desde el
-- cliente en vez de hacer varios insert sueltos, para que una venta
-- nunca quede a medias si algo falla a mitad de camino (p. ej. se
-- crea la venta pero falla el pago).
--
-- security invoker (default): corre con los privilegios y las
-- políticas de RLS de quien llama, no las salta. Un cajero solo puede
-- llamar esto para sus propias ventas porque las policies de sales/
-- sale_items/sale_payments/inventory_movements ya se lo permiten.
create or replace function create_sale(
  p_client_uuid uuid,
  p_cash_session_id uuid,
  p_items jsonb,
  p_payments jsonb
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

  insert into sales (client_uuid, cash_session_id, sold_by, subtotal, total)
  values (p_client_uuid, p_cash_session_id, auth.uid(), v_subtotal, v_total)
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

grant execute on function create_sale(uuid, uuid, jsonb, jsonb) to authenticated;
