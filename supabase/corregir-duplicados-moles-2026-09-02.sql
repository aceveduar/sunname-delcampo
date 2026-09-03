-- Corrige los 5 duplicados que dejó actualizar-precios-chiles-moles-
-- 2026-09-02.sql: esos 5 productos ya existían en el catálogo con un
-- nombre sin marca, así que la comparación por nombre no los encontró
-- y se creó una fila nueva en vez de actualizar la que ya existía.
--
-- Aquí se conserva la fila ORIGINAL (por si ya tiene historial de
-- ventas/inventario) con el nombre y precio correctos, y se borra la
-- copia nueva -- esa copia se acaba de crear en el script anterior,
-- no tiene ninguna venta ni movimiento de inventario detrás, es
-- segura de borrar.
--
-- Correr en el SQL Editor de producción, después del script anterior.

begin;

do $$
declare
  v_pair record;
  v_old_id uuid;
  v_new_id uuid;
begin
  for v_pair in
    select * from (values
      ('Mole Almendra En Polvo', 'Mole Almendra en Polvo, Marca Chío'),
      ('Mole Picosito En Polvo', 'Mole Picosito en Polvo, Marca Rocío'),
      ('Mole Rojo Actopan En Pasta', 'Mole Rojo Actopan, Marca Don Pancho'),
      ('Mole Verde En Pasta', 'Mole Verde en Pasta, Marca Don Pancho'),
      ('Pipián En Polvo', 'Pipián en Polvo, Marca Joya')
    ) as t(old_name, new_name)
  loop
    select id into v_old_id from products where name = v_pair.old_name;
    select id into v_new_id from products where name = v_pair.new_name;

    if v_old_id is null or v_new_id is null then
      raise notice 'Saltando % / % -- no encontré las dos filas esperadas', v_pair.old_name, v_pair.new_name;
      continue;
    end if;

    update products
    set
      name = v_pair.new_name,
      price = (select price from products where id = v_new_id),
      price_per_100g = (select price_per_100g from products where id = v_new_id),
      active = true,
      sold_by_weight = true,
      category_id = (select category_id from products where id = v_new_id),
      unit_id = (select unit_id from products where id = v_new_id)
    where id = v_old_id;

    delete from products where id = v_new_id;
  end loop;
end $$;

commit;

-- Verificación 1: ya no debe haber ninguno de los 5 nombres viejos.
select name, price, active from products
where name in (
  'Mole Almendra En Polvo', 'Mole Picosito En Polvo',
  'Mole Rojo Actopan En Pasta', 'Mole Verde En Pasta', 'Pipián En Polvo'
);

-- Verificación 2: el duplicado de "Chile Puya" -- este NO se toca
-- automáticamente, aquí solo se muestra para que decidas cuál
-- conservar. Si una de las dos filas ya tiene ventas o movimientos de
-- inventario reales, ESA es la que hay que conservar.
select
  p.id, p.name, p.price, p.active, p.created_at,
  (select count(*) from sale_items si where si.product_id = p.id) as ventas,
  (select count(*) from inventory_movements im where im.product_id = p.id) as movimientos_inventario
from products p
where p.name = 'Chile Puya';
