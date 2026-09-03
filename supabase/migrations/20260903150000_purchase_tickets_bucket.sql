-- Bucket para las fotos de tickets/notas de proveedor (captura de
-- compras por foto, ver docs/captura-tickets-analisis.md).
--
-- PRIVADO, a diferencia de product-images: un ticket trae el RFC del
-- proveedor, precios de compra y márgenes -- información de costo, que
-- CLAUDE.md §6 ya trata como admin-only (misma razón por la que un
-- cajero no ve products.cost). Se lee con URL firmada, no pública.
--
-- La foto se conserva a propósito aunque ya se haya capturado la compra:
-- es el respaldo para volver al papel cuando un costo no cuadre.

insert into storage.buckets (id, name, public)
values ('purchase-tickets', 'purchase-tickets', false);

create policy purchase_tickets_select on storage.objects for select
  to authenticated
  using (bucket_id = 'purchase-tickets' and current_role_key() in ('owner', 'local_admin'));

create policy purchase_tickets_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'purchase-tickets' and current_role_key() in ('owner', 'local_admin'));

create policy purchase_tickets_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'purchase-tickets' and current_role_key() in ('owner', 'local_admin'));
