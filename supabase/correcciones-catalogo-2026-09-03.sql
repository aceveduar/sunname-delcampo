-- Correcciones de catálogo confirmadas por el dueño el 2026-09-03.
--
-- Todo va en una transacción: o entra completo o no entra nada. Y todo
-- es idempotente -- correrlo dos veces no hace daño.
--
-- Se aplica el mismo criterio que usa delete_product: un producto solo se
-- borra si nunca operó (sin ventas, sin inventario, sin compras). Si
-- alguno resulta tener historia, el script NO lo borra y avisa, para que
-- se resuelva a mano en vez de destruir un registro real.

begin;

-- ── 1. Arroz Samam se vende por peso ──────────────────────────────────
-- Estaba en KG pero sin venta por peso: así solo se podía despachar en
-- kilos enteros, sin poder pesar 300 g ni cobrar "$50 de arroz".
--
-- price_per_100g se pone en 0 si venía en null: el candado
-- products_price_per_100g_required exige que un producto a granel tenga
-- ese campo (no nulo, aunque sí puede ser 0). Es la misma convención que
-- ya tienen los demás productos sin precio cargado, y Caja ya sabe
-- manejarla -- avisa "Este producto todavía no tiene precio" en vez de
-- dejar cobrar $0. Cuando llegue el precio real hay que llenar los dos:
-- el del kilo y el de 100 g.
update products
set sold_by_weight = true,
    price_per_100g = coalesce(price_per_100g, 0)
where name = 'Arroz Samam';

-- ── 2. Las hojas se venden por manojo, no en costal ───────────────────
-- Estaban en COS (Costal), que fue el default alfabético accidental. La
-- corrección de agosto no las alcanzó porque solo buscó productos con
-- sold_by_weight = true.
insert into units_of_measure (code, name)
select 'MAN', 'Manojo'
where not exists (select 1 from units_of_measure where code = 'MAN');

update products
set unit_id = (select id from units_of_measure where code = 'MAN'),
    sold_by_weight = false
where name in ('Hojas Para Mixiotes', 'Hojas Para Tamales');

-- ── 3 y 4. Erratas con duplicado ──────────────────────────────────────
-- "Chile Ayanero" no existe: es "Chile Habanero". El mal escrito es el
-- que está activo y con precios cargados, así que se renombra ese (para
-- no perder los precios) y se borra el "Chile Habanero" inactivo.
-- Igual con "Chile De Árbol Teja", errata de "Chile de Árbol (Reja)".
do $$
declare
  v_dup record;
  v_ventas int;
  v_movs int;
  v_compras int;
begin
  for v_dup in
    select id, name from products
    where name in ('Chile Habanero', 'Chile De Árbol Teja')
      and active = false
  loop
    select count(*) into v_ventas from sale_items where product_id = v_dup.id;
    select count(*) into v_movs from inventory_movements where product_id = v_dup.id;
    select count(*) into v_compras from purchase_order_items where product_id = v_dup.id;

    if v_ventas + v_movs + v_compras = 0 then
      delete from products where id = v_dup.id;
      raise notice 'Borrado el duplicado "%" (nunca operó).', v_dup.name;
    else
      raise notice
        'NO se borró "%": tiene historia (% ventas, % movimientos, % compras). Revísalo a mano.',
        v_dup.name, v_ventas, v_movs, v_compras;
    end if;
  end loop;
end;
$$;

-- Se renombra solo si el nombre correcto quedó libre, para no dejar dos
-- productos con el mismo nombre si el duplicado no se pudo borrar.
update products
set name = 'Chile Habanero'
where name = 'Chile Ayanero'
  and not exists (select 1 from products where name = 'Chile Habanero');

update products
set name = 'Chile de Árbol (Reja)'
where name = 'Chile De Árbol Teja'
  and not exists (select 1 from products where name = 'Chile de Árbol (Reja)');

-- ── Comprobación ──────────────────────────────────────────────────────
select u.code as unidad, p.name, p.active, p.sold_by_weight
from products p
join units_of_measure u on u.id = p.unit_id
where p.name in (
  'Arroz Samam', 'Hojas Para Mixiotes', 'Hojas Para Tamales',
  'Chile Habanero', 'Chile Ayanero',
  'Chile de Árbol (Reja)', 'Chile De Árbol Teja'
)
order by p.name;

commit;
