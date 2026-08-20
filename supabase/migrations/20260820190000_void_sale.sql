-- Anular una venta con error de captura. Solo owner/local_admin (igual
-- que el resto de correcciones sensibles) -- un cajero no puede borrar
-- su propio rastro. Revierte el inventario con un movimiento 'in'
-- compensatorio (nunca se edita/borra el movimiento 'out' original,
-- para no perder el historial real de lo que pasó).

create function void_sale(p_sale_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_status sale_status;
begin
  v_caller_role := current_role_key();
  if v_caller_role not in ('owner', 'local_admin') then
    raise exception 'No autorizado para anular ventas';
  end if;

  select status into v_status from sales where id = p_sale_id;
  if v_status is null then
    raise exception 'Venta % no encontrada', p_sale_id;
  end if;
  if v_status = 'voided' then
    raise exception 'Esta venta ya está anulada';
  end if;

  update sales set status = 'voided' where id = p_sale_id;

  insert into inventory_movements (product_id, type, quantity, reference_type, reference_id, notes, created_by)
  select si.product_id, 'in', si.quantity, 'sale_void', p_sale_id, p_reason, auth.uid()
  from sale_items si
  join products p on p.id = si.product_id
  where si.sale_id = p_sale_id and p.track_inventory;
end;
$$;

grant execute on function void_sale(uuid, text) to authenticated;
