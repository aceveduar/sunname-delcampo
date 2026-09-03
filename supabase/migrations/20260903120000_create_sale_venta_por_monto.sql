-- Venta a granel "por monto": cuando el cliente pide "$50 de piquín", el
-- total debe ser exactamente $50 -- si paga con $50 no hay cambio, y si
-- paga con $100 el cambio son $50. Hasta ahora el sistema hacía lo
-- contrario: derivaba un peso en gramos enteros y cobraba peso × tarifa,
-- así que "$50" terminaban siendo $49.80 o $49.92 según el producto, y
-- el cajero tenía que dar centavos de cambio sobre un monto redondo.
-- Regla confirmada con el dueño (2026-09-03).
--
-- Cómo se resuelve: el item puede traer 'amount' en vez de 'quantity'.
-- Si viene 'amount', el SERVIDOR deriva el peso (misma regla de tarifa
-- de siempre: menos de 250g a precio de 100g, de 250g en adelante a
-- precio de kilo) y fija el subtotal en el monto exacto. El precio sigue
-- saliendo del catálogo -- el cliente nunca manda un precio, solo cuánto
-- dinero pidió el comprador, igual que mandaba cuántos gramos.
--
-- El peso derivado se redondea al gramo más cercano (no hacia abajo):
-- como el precio ya no depende del peso redondeado, truncar solo le
-- quitaría producto al cliente sin razón. La diferencia máxima entre lo
-- pagado y lo entregado queda por debajo de 1 gramo.

create or replace function create_sale(
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
  v_amount numeric(12, 2);
  v_price numeric(12, 2);
  v_price_per_100g numeric(12, 2);
  v_sold_by_weight boolean;
  v_line_subtotal numeric(12, 2);
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
    v_amount := (v_item ->> 'amount')::numeric;

    -- El precio SIEMPRE viene del catálogo, nunca de lo que mande el
    -- cliente -- es la única forma de que sea confiable.
    select price, price_per_100g, sold_by_weight
      into v_price, v_price_per_100g, v_sold_by_weight
      from products where id = v_product_id;
    if v_price is null then
      raise exception 'Producto % no encontrado', v_product_id;
    end if;

    if v_sold_by_weight and v_amount is not null then
      -- Venta por monto: el monto pedido manda, el peso se deriva.
      if v_amount <= 0 then
        raise exception 'El monto de un producto debe ser mayor a cero';
      end if;
      if coalesce(v_price_per_100g, 0) <= 0 or v_price <= 0 then
        raise exception 'El producto % no tiene precio para vender por monto', v_product_id;
      end if;

      if v_amount >= 0.25 * v_price then
        v_quantity := round(v_amount / v_price, 3);
      else
        v_quantity := round(v_amount / v_price_per_100g / 10, 3);
      end if;

      if v_quantity <= 0 then
        raise exception 'El monto pedido es demasiado bajo para pesar este producto';
      end if;

      v_line_subtotal := v_amount;
      v_unit_price := round(v_line_subtotal / v_quantity, 2);
    else
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'La cantidad de un producto debe ser mayor a cero';
      end if;

      if v_sold_by_weight then
        -- Quiebre en 1/4 kg (250g), no en 1kg: confirmado con el dueño
        -- (2026-09-03) -- la tarifa de 100g aplica abajo de 250g, la de
        -- kilo de 250g en adelante.
        if v_quantity >= 0.25 then
          v_line_subtotal := round(v_quantity * v_price, 2);
        else
          v_line_subtotal := round((v_quantity * 1000 / 100) * v_price_per_100g, 2);
        end if;
        v_unit_price := round(v_line_subtotal / v_quantity, 2);
      else
        v_unit_price := v_price;
        v_line_subtotal := round(v_quantity * v_price, 2);
      end if;
    end if;

    insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (v_sale_id, v_product_id, v_quantity, v_unit_price, v_line_subtotal);

    v_subtotal := v_subtotal + v_line_subtotal;

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
