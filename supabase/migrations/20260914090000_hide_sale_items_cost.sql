-- Cierra el hallazgo Crítico de la auditoría técnica (2026-09-13):
-- sale_items_select era "using (true)" para toda la fila, incluida
-- unit_cost (el margen de cada venta, congelado desde el 9 de
-- septiembre) -- la política nunca se revisó al agregar esa columna.
-- Cualquier cajero autenticado podía pedir unit_cost/quantity directo
-- contra la API y reconstruir el margen de cualquier producto vendido.
--
-- Mismo tratamiento que ya se le dio a products.cost el 20 de agosto
-- (20260820174738_hide_product_cost.sql): RLS no filtra por columna,
-- solo por fila -- así que la tabla base queda admin-only y todo lo
-- que no necesita el costo (Caja, "Más vendidos") lee una vista sin
-- unit_cost.

drop policy sale_items_select on sale_items;
create policy sale_items_select on sale_items for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));

create view sale_items_public as
select id, sale_id, product_id, quantity, unit_price, subtotal
from sale_items;

grant select on sale_items_public to authenticated;
grant select on sale_items_public to service_role;
