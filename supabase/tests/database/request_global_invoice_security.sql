-- Pruebas de request_global_invoice() -- la cáscara de CFDI 4.0
-- construida el 2026-09-02 (CLAUDE.md §15). No timbra nada todavía
-- (no hay PAC conectado); esto solo cubre las validaciones de negocio
-- antes de dejar una solicitud en 'pending', para que una migración
-- futura no las afloje sin que CI lo note.
begin;
select plan(8);

-- ── Fixtures (como el rol que corre las migraciones, sin RLS de por
-- medio) ──────────────────────────────────────────────────────────────
insert into units_of_measure (id, code, name)
values ('10000000-0000-0000-0000-000000000001', 'KG', 'Kilogramo');

insert into products (id, name, price, unit_id)
values (
  '10000000-0000-0000-0000-000000000002',
  'Producto de prueba',
  100.00,
  '10000000-0000-0000-0000-000000000001'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000003',
  'owner-invoice@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);
update profiles set role = 'owner' where id = '10000000-0000-0000-0000-000000000003';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000004',
  'cashier-invoice@example.com',
  '{"full_name": "Cajero De Prueba"}'::jsonb
);

-- Corte cerrado con una venta completada de $100.
insert into cash_sessions (id, opened_by, opening_amount, status, closed_by, closed_at, closing_amount)
values (
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000003',
  0, 'closed',
  '10000000-0000-0000-0000-000000000003', now(), 100
);
insert into sales (id, client_uuid, cash_session_id, sold_by, status, subtotal, total)
values (
  '10000000-0000-0000-0000-000000000006', gen_random_uuid(),
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000003', 'completed', 100, 100
);

-- Corte todavía abierto.
insert into cash_sessions (id, opened_by, opening_amount, status)
values (
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000003',
  0, 'open'
);

-- Corte cerrado sin ninguna venta completada.
insert into cash_sessions (id, opened_by, opening_amount, status, closed_by, closed_at, closing_amount)
values (
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000003',
  0, 'closed',
  '10000000-0000-0000-0000-000000000003', now(), 0
);

-- Test 1: un cajero no puede solicitar una factura global.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000005')$$,
  '%No autorizado%',
  'Un cajero no puede llamar request_global_invoice'
);

reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated"}';

-- Test 2: el módulo de Facturación viene apagado por default (init_core.sql).
select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000005')$$,
  '%Facturación no está activo%',
  'request_global_invoice rechaza si el módulo de Facturación está apagado'
);

reset role;
update tenant_modules set enabled = true where module_key = 'billing';
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated"}';

-- Test 3: con el módulo activo pero sin datos fiscales capturados.
select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000005')$$,
  '%datos fiscales%',
  'request_global_invoice rechaza si faltan los datos fiscales del negocio'
);

reset role;
update tenant_fiscal_settings
  set rfc = 'XAXX010101000', legal_name = 'Del Campo', regimen_fiscal = '626', postal_code = '76000'
  where id = 1;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub": "10000000-0000-0000-0000-000000000003", "role": "authenticated"}';

-- Test 4: un corte todavía abierto no se puede facturar.
select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000007')$$,
  '%debe estar cerrado%',
  'request_global_invoice rechaza un corte de caja todavía abierto'
);

-- Test 5: un corte cerrado sin ventas no se puede facturar.
select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000008')$$,
  '%no tiene ventas%',
  'request_global_invoice rechaza un corte de caja sin ventas completadas'
);

-- Test 6: con todo en orden, deja la solicitud en 'pending' con el total real.
select lives_ok(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000005')$$,
  'request_global_invoice acepta un corte cerrado, con ventas y datos fiscales completos'
);

select is(
  (select status::text from fiscal_invoices where cash_session_id = '10000000-0000-0000-0000-000000000005'),
  'pending',
  'La factura queda en pending -- todavía no hay PAC conectado que la timbre'
);

-- Test 7: no se puede solicitar dos veces para el mismo corte.
select throws_like(
  $$select request_global_invoice('10000000-0000-0000-0000-000000000005')$$,
  '%Ya existe una factura%',
  'request_global_invoice rechaza una segunda solicitud para el mismo corte'
);

select * from finish();
rollback;
