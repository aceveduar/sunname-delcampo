-- Cierra el hallazgo Medio de la auditoría (2026-08-20): products_select
-- era "using (true)" para toda la fila, incluido cost (margen), pese a
-- que CLAUDE.md §6 dice explícitamente que un cajero no debe tener
-- acceso a costos. RLS no filtra por columna, solo por fila -- así que
-- la única forma correcta es: la tabla base queda admin-only, y todo
-- el resto lee una vista sin la columna cost.

drop policy products_select on products;
create policy products_select on products for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));

create view product_catalog as
select
  id, sku, name, description, category_id, unit_id, price,
  track_inventory, active, created_at, updated_at
from products;

grant select on product_catalog to authenticated;
