-- Pruebas del alcance de un local_admin al editar perfiles (Usuarios).
-- CLAUDE.md §6: un administrador de local solo gestiona cajeros -- mismo
-- alcance que ya tiene invite-user, extendido aquí a editar un usuario
-- ya existente (hallazgo de la auditoría 2026-09-09: no había ningún
-- candado del lado del servidor, solo la UI deshabilitaba la fila propia).
begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '50000000-0000-0000-0000-000000000001',
  'owner-roles@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);
update profiles set role = 'owner' where id = '50000000-0000-0000-0000-000000000001';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '50000000-0000-0000-0000-000000000002',
  'admin-roles@example.com',
  '{"full_name": "Admin De Prueba"}'::jsonb
);
update profiles set role = 'local_admin' where id = '50000000-0000-0000-0000-000000000002';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '50000000-0000-0000-0000-000000000003',
  'cashier-roles@example.com',
  '{"full_name": "Cajero De Prueba"}'::jsonb
);
-- Ya nace 'cashier' por handle_new_user(); se deja explícito para claridad.
update profiles set role = 'cashier' where id = '50000000-0000-0000-0000-000000000003';

-- ── Como administrador de local ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000002';
set local request.jwt.claims = '{"sub": "50000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select throws_like(
  $$update profiles set role = 'owner' where id = '50000000-0000-0000-0000-000000000002'$$,
  '%solo puede gestionar cajeros%',
  'Un administrador de local no puede volverse owner a sí mismo'
);

select throws_like(
  $$update profiles set role = 'local_admin' where id = '50000000-0000-0000-0000-000000000003'$$,
  '%solo puede gestionar cajeros%',
  'Un administrador de local no puede ascender a un cajero a local_admin'
);

select throws_like(
  $$update profiles set active = false where id = '50000000-0000-0000-0000-000000000001'$$,
  '%solo puede gestionar cajeros%',
  'Un administrador de local no puede desactivar al propietario'
);

select lives_ok(
  $$update profiles set active = false where id = '50000000-0000-0000-0000-000000000003'$$,
  'Un administrador de local sí puede desactivar a un cajero'
);

select lives_ok(
  $$update profiles set full_name = 'Cajero Renombrado' where id = '50000000-0000-0000-0000-000000000001'$$,
  'Editar el nombre de otro perfil no pasa por el candado de rol/estado'
);

-- ── Como owner ────────────────────────────────────────────────────────
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000001';
set local request.jwt.claims = '{"sub": "50000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$update profiles set role = 'local_admin' where id = '50000000-0000-0000-0000-000000000003'$$,
  'El propietario sí puede ascender a un cajero a local_admin'
);

select is(
  (select role from profiles where id = '50000000-0000-0000-0000-000000000003'),
  'local_admin',
  'El ascenso del propietario sí surtió efecto'
);

select * from finish();
rollback;
