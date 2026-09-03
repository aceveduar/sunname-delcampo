-- Aplica los precios reales que el dueño dio en sus hojas del 21 de
-- agosto (Chiles Secos + Moles, primera tanda). Desactiva TODO el
-- catálogo primero y solo reactiva los productos confirmados aquí --
-- el resto queda inactivo hasta que se suban más hojas con precios
-- reales. Precio guardado = precio por kilo; el cuarto se calcula
-- (kilo ÷ 4, confirmado exacto en los 27 productos revisados) y no se
-- guarda aparte. price_per_100g sí es una tarifa independiente (más
-- cara por gramo que comprar el cuarto o el kilo).
--
-- Correr esto en el SQL Editor de Supabase, proyecto de PRODUCCIÓN
-- (sunname-delcampo). Al final hay una consulta de verificación --
-- pégame su resultado para confirmar que todo quedó bien.

begin;

-- 1. Desactivar todo el catálogo.
update products set active = false;

-- 2. Asegurar las categorías (no falla si ya existen).
insert into product_categories (name)
select 'Chiles Secos'
where not exists (select 1 from product_categories where name = 'Chiles Secos');

insert into product_categories (name)
select 'Moles'
where not exists (select 1 from product_categories where name = 'Moles');

-- 3. Actualizar el existente por nombre (sin importar mayúsculas) o
-- crear el producto si no existe todavía.
do $$
declare
  v_kg_id uuid;
  v_chiles_cat uuid;
  v_moles_cat uuid;
  v_row record;
begin
  select id into v_kg_id from units_of_measure where code = 'KG';
  select id into v_chiles_cat from product_categories where name = 'Chiles Secos';
  select id into v_moles_cat from product_categories where name = 'Moles';

  if v_kg_id is null then
    raise exception 'No existe la unidad KG -- revisa units_of_measure antes de continuar';
  end if;

  for v_row in
    select * from (values
      ('Chile Guajillo Herradura', 23.00, 198.00, v_chiles_cat),
      ('Chile Guajillo Rojo', 17.00, 140.00, v_chiles_cat),
      ('Chile Puya', 19.00, 160.00, v_chiles_cat),
      ('Chile de Árbol (Reja)', 16.00, 140.00, v_chiles_cat),
      ('Chile Morita', 16.00, 140.00, v_chiles_cat),
      ('Chile Mora Sin Pata', 18.00, 160.00, v_chiles_cat),
      ('Chile Mora Con Pata', 16.00, 140.00, v_chiles_cat),
      ('Chile Mulato', 28.00, 250.00, v_chiles_cat),
      ('Chile Ancho de 1ra', 26.00, 220.00, v_chiles_cat),
      ('Chile Ancho de 2da', 23.00, 200.00, v_chiles_cat),
      ('Chile Cascabel', 30.00, 280.00, v_chiles_cat),
      ('Chile Ayanero', 20.00, 180.00, v_chiles_cat),
      ('Chile Pasilla de 1ra', 29.00, 270.00, v_chiles_cat),
      ('Chile Pasilla de 2da', 20.00, 180.00, v_chiles_cat),
      ('Chile Piquín Entero', 60.00, 512.00, v_chiles_cat),
      ('Chile Chipotle Meco', 39.00, 370.00, v_chiles_cat),
      ('Chile Catarina', 30.00, 280.00, v_chiles_cat),
      ('Mole Almendra en Polvo, Marca Chío', 19.00, 172.00, v_moles_cat),
      ('Mole Picosito en Polvo, Marca Rocío', 18.00, 160.00, v_moles_cat),
      ('Pepita Compuesta en Polvo, Marca Quetzal', 10.00, 80.00, v_moles_cat),
      ('Pepita Simple en Polvo, Marca Finca', 9.00, 72.00, v_moles_cat),
      ('Pipián en Polvo, Marca Joya', 17.00, 152.00, v_moles_cat),
      ('Adobo en Polvo, Marca Don Pancho', 17.00, 152.00, v_moles_cat),
      ('Mole Rojo Actopan, Marca Don Pancho', 19.00, 172.00, v_moles_cat),
      ('Mole Verde en Pasta, Marca Don Pancho', 17.00, 156.00, v_moles_cat),
      ('Consomé de Pollo en Polvo, Marca Don Lalo', 6.00, 40.00, v_moles_cat)
    ) as t(name, price_per_100g, price_per_kg, category_id)
  loop
    update products
    set
      price = v_row.price_per_kg,
      price_per_100g = v_row.price_per_100g,
      active = true,
      sold_by_weight = true,
      category_id = v_row.category_id,
      unit_id = coalesce(unit_id, v_kg_id)
    where lower(name) = lower(v_row.name);

    if not found then
      insert into products (name, price, price_per_100g, sold_by_weight, category_id, unit_id, active, track_inventory)
      values (v_row.name, v_row.price_per_kg, v_row.price_per_100g, true, v_row.category_id, v_kg_id, true, true);
    end if;
  end loop;
end $$;

commit;

-- Verificación -- pégame este resultado.
select name, price as precio_kg, price_per_100g, active, sold_by_weight
from products
where category_id in (
  select id from product_categories where name in ('Chiles Secos', 'Moles')
)
order by name;
