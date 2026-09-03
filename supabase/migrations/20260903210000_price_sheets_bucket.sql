-- Bucket para las fotos de las hojas de precios escritas a mano por el
-- dueño (carga de precios por foto).
--
-- PRIVADO, igual que purchase-tickets: una hoja de precios es la lista
-- completa de márgenes del negocio, exactamente el tipo de información
-- que CLAUDE.md §6 mantiene fuera del alcance de un cajero.
--
-- La foto se conserva aunque los precios ya se hayan aplicado: cuando un
-- precio se vea raro dentro de tres meses, el papel original es la única
-- forma de saber si se capturó mal o si de verdad era ese.

insert into storage.buckets (id, name, public)
values ('price-sheets', 'price-sheets', false);

create policy price_sheets_select on storage.objects for select
  to authenticated
  using (bucket_id = 'price-sheets' and current_role_key() in ('owner', 'local_admin'));

create policy price_sheets_insert on storage.objects for insert
  to authenticated
  with check (bucket_id = 'price-sheets' and current_role_key() in ('owner', 'local_admin'));

create policy price_sheets_delete on storage.objects for delete
  to authenticated
  using (bucket_id = 'price-sheets' and current_role_key() in ('owner', 'local_admin'));
