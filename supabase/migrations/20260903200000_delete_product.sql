-- Borrar un producto, pero solo cuando de verdad no se pierde nada.
--
-- El caso real: dar de alta un producto por error, o duplicado, y querer
-- quitarlo del catálogo en vez de arrastrarlo desactivado para siempre.
-- Hasta ahora la única salida era desactivarlo, que es correcto para un
-- producto que ya operó pero es ruido para uno que nunca existió.
--
-- La regla no es de permisos, es de integridad: un producto SIN historia
-- (sin ventas, sin movimientos de inventario, sin compras) no lo
-- referencia nada, así que borrarlo no destruye ningún registro. Uno CON
-- historia no se borra nunca, porque hacerlo rompería el rastro de
-- operaciones que de verdad ocurrieron -- por eso esas tres llaves
-- foráneas están puestas para bloquear, y aquí no se fuerzan: se explica.
--
-- Por eso esta función NO es temporal ni "para la etapa de pruebas". Es
-- correcta siempre, y no hay que acordarse de quitarla después.
--
-- Lo que sí cae solo es lo derivado: el historial de precios y las
-- equivalencias de proveedor de un producto que nunca operó no le sirven
-- a nadie (ambas llaves ya son on delete cascade).

create or replace function delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_sales int;
  v_movements int;
  v_purchases int;
begin
  -- Borrar del catálogo es una decisión de dueño, no de operación diaria
  -- (CLAUDE.md §6): un administrador de local puede desactivar, no borrar.
  if current_role_key() <> 'owner' then
    raise exception 'Solo el propietario puede borrar un producto';
  end if;

  select name into v_name from products where id = p_product_id;
  if v_name is null then
    raise exception 'Producto no encontrado';
  end if;

  select count(*) into v_sales from sale_items where product_id = p_product_id;
  select count(*) into v_movements from inventory_movements where product_id = p_product_id;
  select count(*) into v_purchases from purchase_order_items where product_id = p_product_id;

  if v_sales > 0 or v_movements > 0 or v_purchases > 0 then
    raise exception
      'No se puede borrar "%": ya tiene historia (% ventas, % movimientos de inventario, % compras). Desactívalo en vez de borrarlo, para no perder el rastro de esas operaciones.',
      v_name, v_sales, v_movements, v_purchases;
  end if;

  delete from products where id = p_product_id;
end;
$$;

grant execute on function delete_product(uuid) to authenticated;
