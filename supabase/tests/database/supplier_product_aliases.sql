-- Pruebas de supplier_product_aliases: la memoria de equivalencias entre
-- lo que dice el ticket del proveedor y el catálogo propio.
--
-- Lo que se cuida aquí es el alcance: la tabla guarda con qué proveedor se
-- surte cada producto y en qué empaque, que es información de costos --
-- mismo alcance que el resto de Compras, nunca un cajero (CLAUDE.md §6).
begin;
select plan(6);

-- ── Fixtures ──────────────────────────────────────────────────────────
insert into units_of_measure (id, code, name)
values ('30000000-0000-0000-0000-000000000001', 'KG', 'Kilogramo');

insert into products (id, name, price, unit_id)
values (
  '30000000-0000-0000-0000-000000000002',
  'Arroz Saman',
  40.00,
  '30000000-0000-0000-0000-000000000001'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '30000000-0000-0000-0000-000000000003',
  'owner-alias@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);
update profiles set role = 'owner' where id = '30000000-0000-0000-0000-000000000003';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '30000000-0000-0000-0000-000000000004',
  'cashier-alias@example.com',
  '{"full_name": "Cajero De Prueba"}'::jsonb
);

insert into suppliers (id, name)
values ('30000000-0000-0000-0000-000000000005', 'La Herradura');

-- ── Como owner ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set local request.jwt.claims = '{"sub": "30000000-0000-0000-0000-000000000003", "role": "authenticated"}';

select lives_ok(
  $$insert into supplier_product_aliases
      (supplier_id, ticket_text, product_id, units_per_package, created_by)
    values (
      '30000000-0000-0000-0000-000000000005',
      'arroz saman c/25 kg',
      '30000000-0000-0000-0000-000000000002',
      25,
      '30000000-0000-0000-0000-000000000003'
    )$$,
  'Un owner puede guardar una equivalencia'
);

select is(
  (select units_per_package from supplier_product_aliases
   where ticket_text = 'arroz saman c/25 kg'),
  25::numeric,
  'Guarda cuántas unidades del producto trae un empaque del ticket'
);

-- El mismo texto del mismo proveedor no puede apuntar a dos productos:
-- si el usuario corrige, se actualiza la fila, no se agrega otra.
select throws_ok(
  $$insert into supplier_product_aliases (supplier_id, ticket_text, product_id)
    values (
      '30000000-0000-0000-0000-000000000005',
      'arroz saman c/25 kg',
      '30000000-0000-0000-0000-000000000002'
    )$$,
  '23505',
  null,
  'El mismo texto del mismo proveedor no se puede duplicar'
);

-- Un empaque de cero o negativo rompería la conversión (división entre
-- cero al repartir el costo).
select throws_ok(
  $$insert into supplier_product_aliases
      (supplier_id, ticket_text, product_id, units_per_package)
    values (
      '30000000-0000-0000-0000-000000000005',
      'otro texto',
      '30000000-0000-0000-0000-000000000002',
      0
    )$$,
  '23514',
  null,
  'No se acepta un empaque de cero'
);

-- ── Como cajero ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub": "30000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select is(
  (select count(*)::int from supplier_product_aliases),
  0,
  'Un cajero no ve ninguna equivalencia (trae información de costos)'
);

select throws_like(
  $$insert into supplier_product_aliases (supplier_id, ticket_text, product_id)
    values (
      '30000000-0000-0000-0000-000000000005',
      'texto de cajero',
      '30000000-0000-0000-0000-000000000002'
    )$$,
  '%row-level security%',
  'Un cajero no puede guardar equivalencias'
);

select * from finish();
rollback;
