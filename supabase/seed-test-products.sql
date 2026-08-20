-- Datos de prueba: catálogo realista del giro de Del Campo (chiles,
-- moles, semillas y afines) para probar la UI con volumen real
-- (paginación, búsqueda). No es una migración de esquema — se corre
-- a mano, una sola vez, con:
--   supabase db query --linked --file supabase/seed-test-products.sql
--
-- Para borrarlo despues:
--   delete from products where sku like 'TEST-%';
--   delete from product_categories where name like 'Datos de prueba: %';

insert into units_of_measure (code, name)
values
  ('G', 'Gramo'),
  ('L', 'Litro'),
  ('PZA', 'Pieza'),
  ('PAQ', 'Paquete'),
  ('COS', 'Costal')
on conflict (code) do nothing;

-- product_categories no tiene UNIQUE(name), así que el guard de
-- idempotencia va por NOT EXISTS en vez de ON CONFLICT.
insert into product_categories (name)
select v.name
from (
  values
    ('Datos de prueba: Chiles secos'),
    ('Datos de prueba: Chiles frescos'),
    ('Datos de prueba: Moles'),
    ('Datos de prueba: Semillas'),
    ('Datos de prueba: Especias y condimentos'),
    ('Datos de prueba: Granos y legumbres'),
    ('Datos de prueba: Salsas y conservas')
) as v(name)
where not exists (select 1 from product_categories pc where pc.name = v.name);

with ingredients(category_name, ingredient) as (
  values
    ('Datos de prueba: Chiles secos', 'Chile Ancho'),
    ('Datos de prueba: Chiles secos', 'Chile Guajillo'),
    ('Datos de prueba: Chiles secos', 'Chile Pasilla'),
    ('Datos de prueba: Chiles secos', 'Chile Mulato'),
    ('Datos de prueba: Chiles secos', 'Chile Chipotle'),
    ('Datos de prueba: Chiles secos', 'Chile Cascabel'),
    ('Datos de prueba: Chiles secos', 'Chile de Árbol'),
    ('Datos de prueba: Chiles secos', 'Chile Morita'),
    ('Datos de prueba: Chiles secos', 'Chile Puya'),
    ('Datos de prueba: Chiles frescos', 'Chile Jalapeño'),
    ('Datos de prueba: Chiles frescos', 'Chile Serrano'),
    ('Datos de prueba: Chiles frescos', 'Chile Poblano'),
    ('Datos de prueba: Chiles frescos', 'Chile Habanero'),
    ('Datos de prueba: Chiles frescos', 'Chile Manzano'),
    ('Datos de prueba: Chiles frescos', 'Chile Güero'),
    ('Datos de prueba: Moles', 'Mole Rojo'),
    ('Datos de prueba: Moles', 'Mole Negro'),
    ('Datos de prueba: Moles', 'Mole Verde'),
    ('Datos de prueba: Moles', 'Mole Amarillo'),
    ('Datos de prueba: Moles', 'Mole Poblano'),
    ('Datos de prueba: Moles', 'Mole Oaxaqueño'),
    ('Datos de prueba: Moles', 'Mole Coloradito'),
    ('Datos de prueba: Moles', 'Mole Almendrado'),
    ('Datos de prueba: Semillas', 'Semilla de Girasol'),
    ('Datos de prueba: Semillas', 'Semilla de Calabaza'),
    ('Datos de prueba: Semillas', 'Chía'),
    ('Datos de prueba: Semillas', 'Ajonjolí'),
    ('Datos de prueba: Semillas', 'Linaza'),
    ('Datos de prueba: Semillas', 'Amaranto'),
    ('Datos de prueba: Semillas', 'Cacahuate'),
    ('Datos de prueba: Especias y condimentos', 'Comino'),
    ('Datos de prueba: Especias y condimentos', 'Orégano'),
    ('Datos de prueba: Especias y condimentos', 'Canela'),
    ('Datos de prueba: Especias y condimentos', 'Clavo'),
    ('Datos de prueba: Especias y condimentos', 'Pimienta Negra'),
    ('Datos de prueba: Especias y condimentos', 'Anís'),
    ('Datos de prueba: Especias y condimentos', 'Laurel'),
    ('Datos de prueba: Especias y condimentos', 'Cúrcuma'),
    ('Datos de prueba: Especias y condimentos', 'Achiote'),
    ('Datos de prueba: Granos y legumbres', 'Frijol Negro'),
    ('Datos de prueba: Granos y legumbres', 'Frijol Bayo'),
    ('Datos de prueba: Granos y legumbres', 'Frijol Pinto'),
    ('Datos de prueba: Granos y legumbres', 'Arroz'),
    ('Datos de prueba: Granos y legumbres', 'Lenteja'),
    ('Datos de prueba: Granos y legumbres', 'Garbanzo'),
    ('Datos de prueba: Granos y legumbres', 'Haba'),
    ('Datos de prueba: Granos y legumbres', 'Maíz Pozolero'),
    ('Datos de prueba: Salsas y conservas', 'Salsa Roja'),
    ('Datos de prueba: Salsas y conservas', 'Salsa Verde'),
    ('Datos de prueba: Salsas y conservas', 'Salsa de Chipotle'),
    ('Datos de prueba: Salsas y conservas', 'Adobo'),
    ('Datos de prueba: Salsas y conservas', 'Achiote en Pasta')
),
dry_presentations(presentation, unit_code, size_factor) as (
  values
    ('Granel', 'kg', 1.0),
    ('Bolsa 100g', 'PAQ', 0.4),
    ('Bolsa 250g', 'PAQ', 1.0),
    ('Bolsa 500g', 'PAQ', 1.8),
    ('Bolsa 1kg', 'PAQ', 3.2),
    ('Costal 1kg', 'COS', 3.0),
    ('Costal 5kg', 'COS', 14.0),
    ('Costal 10kg', 'COS', 26.0),
    ('Costal 25kg', 'COS', 60.0),
    ('Granel orgánico', 'kg', 1.3)
),
liquid_presentations(presentation, unit_code, size_factor) as (
  values
    ('Frasco 250ml', 'PZA', 1.0),
    ('Botella 500ml', 'PZA', 1.8),
    ('Litro', 'L', 3.0)
),
rows as (
  select i.category_name, i.ingredient, p.presentation, p.unit_code, p.size_factor
  from ingredients i
  join dry_presentations p on i.category_name <> 'Datos de prueba: Salsas y conservas'
  union all
  select i.category_name, i.ingredient, p.presentation, p.unit_code, p.size_factor
  from ingredients i
  join liquid_presentations p on i.category_name = 'Datos de prueba: Salsas y conservas'
)
insert into products (sku, name, category_id, unit_id, price, cost, track_inventory)
select
  'TEST-' || lpad(row_number() over (order by r.category_name, r.ingredient, r.presentation)::text, 4, '0'),
  r.ingredient || ' — ' || r.presentation,
  c.id,
  u.id,
  round(((8 + random() * 12) * r.size_factor)::numeric, 2),
  round(((4 + random() * 6) * r.size_factor)::numeric, 2),
  true
from rows r
join product_categories c on c.name = r.category_name
join units_of_measure u on u.code = r.unit_code
on conflict (sku) do nothing;
