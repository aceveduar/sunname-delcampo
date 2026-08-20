-- Fotos de producto en Catálogo (CLAUDE.md §3, anotado como pendiente
-- futuro el 2026-08-20): solo un bucket de Storage + columna image_url,
-- sin tocar nada de lo ya construido.

alter table products add column image_url text;

drop view product_catalog;
create view product_catalog as
select
  id, sku, name, description, category_id, unit_id, price,
  sold_by_weight, price_per_100g, image_url,
  track_inventory, active, created_at, updated_at
from products;

grant select on product_catalog to authenticated;
grant select on product_catalog to service_role;

-- Bucket público para lectura (una foto de producto no es información
-- sensible, a diferencia de cost) -- la URL pública sirve la imagen
-- directo, sin necesidad de firmar cada request. Solo owner/local_admin
-- pueden subir/editar/borrar, igual que el resto del catálogo.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

create policy product_images_select on storage.objects for select
  to public using (bucket_id = 'product-images');

create policy product_images_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and current_role_key() in ('owner', 'local_admin'));

create policy product_images_update on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and current_role_key() in ('owner', 'local_admin'));

create policy product_images_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and current_role_key() in ('owner', 'local_admin'));
