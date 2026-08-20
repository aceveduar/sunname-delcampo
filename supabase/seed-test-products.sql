-- Datos de prueba: ~500 productos para probar el catálogo con volumen
-- real (paginación, búsqueda, rendimiento de la tabla). No es una
-- migración de esquema — se corre a mano, una sola vez, con:
--   supabase db query --linked --file supabase/seed-test-products.sql
--
-- Para borrarlos despues:
--   delete from products where sku like 'TEST-%';
--   delete from product_categories where name = 'Datos de prueba';

insert into product_categories (name)
select 'Datos de prueba'
where not exists (select 1 from product_categories where name = 'Datos de prueba');

do $$
declare
  v_category_id uuid;
  v_units uuid[];
  v_words text[] := array['Chile','Mole','Semilla','Especia','Salsa','Condimento','Hierba','Grano','Polvo','Mezcla'];
  v_variants text[] := array['Ancho','Guajillo','Pasilla','Rojo','Verde','Negro','Amarillo','de Girasol','de Calabaza','Casero','Artesanal','Premium','Tradicional','Especial','del Valle'];
  i int;
begin
  select id into v_category_id from product_categories where name = 'Datos de prueba';
  select array_agg(id) into v_units from units_of_measure where active;

  if v_units is null or array_length(v_units, 1) = 0 then
    raise exception 'No hay ninguna unidad de medida activa; crea al menos una antes de correr este script.';
  end if;

  for i in 1..500 loop
    insert into products (sku, name, category_id, unit_id, price, cost, track_inventory)
    values (
      'TEST-' || lpad(i::text, 4, '0'),
      v_words[1 + (i % array_length(v_words, 1))] || ' ' || v_variants[1 + (i % array_length(v_variants, 1))] || ' ' || i,
      v_category_id,
      v_units[1 + (i % array_length(v_units, 1))],
      round((10 + random() * 190)::numeric, 2),
      round((5 + random() * 100)::numeric, 2),
      true
    )
    on conflict (sku) do nothing;
  end loop;
end $$;
