-- Catálogo real inicial de Del Campo (primer lote de productos dados
-- por el dueño). Cada producto se vende en dos presentaciones con
-- precio propio (no proporcional entre sí), así que cada una es su
-- propia fila en products, siguiendo el mismo patrón usado en pruebas:
--   - "<nombre> — Kilo"  → unidad KG, se vende por kilogramo.
--   - "<nombre> — 100g"  → unidad PAQ, bolsa/paquete de 100g a precio fijo.

insert into product_categories (name) values
  ('Semillas'),
  ('Frutos secos y pasas'),
  ('Especias'),
  ('Harinas y féculas'),
  ('Chiles secos')
on conflict do nothing;

with u as (
  select
    (select id from units_of_measure where code = 'KG') as kg,
    (select id from units_of_measure where code = 'PAQ') as paq
),
c as (
  select
    (select id from product_categories where name = 'Semillas') as semillas,
    (select id from product_categories where name = 'Frutos secos y pasas') as frutos_secos,
    (select id from product_categories where name = 'Especias') as especias,
    (select id from product_categories where name = 'Harinas y féculas') as harinas,
    (select id from product_categories where name = 'Chiles secos') as chiles
)
insert into products (sku, name, category_id, unit_id, price, cost)
select 'AJO-KG', 'Ajonjolí Moreno — Kilo', c.semillas, u.kg, 80.00, 32.00 from u, c
union all
select 'AJO-100G', 'Ajonjolí Moreno — 100g', c.semillas, u.paq, 10.00, 3.20 from u, c
union all
select 'CAC-KG', 'Cacahuate tostado — Kilo', c.frutos_secos, u.kg, 80.00, 48.00 from u, c
union all
select 'CAC-100G', 'Cacahuate tostado — 100g', c.frutos_secos, u.paq, 10.00, 4.80 from u, c
union all
select 'COM-KG', 'Comino entero — Kilo', c.especias, u.kg, 100.00, 55.00 from u, c
union all
select 'COM-100G', 'Comino entero — 100g', c.especias, u.paq, 13.00, 5.50 from u, c
union all
select 'TAP-KG', 'Tapioca — Kilo', c.harinas, u.kg, 80.00, 52.00 from u, c
union all
select 'TAP-100G', 'Tapioca — 100g', c.harinas, u.paq, 10.00, 5.20 from u, c
union all
select 'GUA-KG', 'Guajillo herradura — Kilo', c.chiles, u.kg, 220.00, 149.00 from u, c
union all
select 'GUA-100G', 'Guajillo herradura — 100g', c.chiles, u.paq, 23.00, 14.90 from u, c;
