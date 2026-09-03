-- Pruebas de delete_product(). Es una operación destructiva sobre el
-- catálogo, así que lo que se cuida es que solo borre lo que de verdad
-- no le importa a nadie: sin ventas, sin inventario y sin compras.
begin;
select plan(9);

-- ── Fixtures ──────────────────────────────────────────────────────────
insert into units_of_measure (id, code, name)
values ('40000000-0000-0000-0000-000000000001', 'KG', 'Kilogramo');

-- Producto limpio: nunca operó.
insert into products (id, name, price, unit_id)
values (
  '40000000-0000-0000-0000-000000000002',
  'Producto Duplicado Por Error',
  50.00,
  '40000000-0000-0000-0000-000000000001'
);

-- Producto con historia de venta.
insert into products (id, name, price, unit_id)
values (
  '40000000-0000-0000-0000-000000000003',
  'Producto Con Ventas',
  50.00,
  '40000000-0000-0000-0000-000000000001'
);

-- Producto con historia de compra.
insert into products (id, name, price, unit_id)
values (
  '40000000-0000-0000-0000-000000000004',
  'Producto Con Compras',
  50.00,
  '40000000-0000-0000-0000-000000000001'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '40000000-0000-0000-0000-000000000005',
  'owner-delete@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);
update profiles set role = 'owner' where id = '40000000-0000-0000-0000-000000000005';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '40000000-0000-0000-0000-000000000006',
  'admin-delete@example.com',
  '{"full_name": "Admin De Prueba"}'::jsonb
);
update profiles set role = 'local_admin' where id = '40000000-0000-0000-0000-000000000006';

insert into cash_sessions (id, opened_by, opening_amount, status)
values (
  '40000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000005',
  0, 'open'
);
insert into sales (id, client_uuid, cash_session_id, sold_by, status, subtotal, total)
values (
  '40000000-0000-0000-0000-000000000008', gen_random_uuid(),
  '40000000-0000-0000-0000-000000000007',
  '40000000-0000-0000-0000-000000000005', 'completed', 50, 50
);
insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
values (
  '40000000-0000-0000-0000-000000000008',
  '40000000-0000-0000-0000-000000000003',
  1, 50, 50
);

insert into suppliers (id, name)
values ('40000000-0000-0000-0000-000000000009', 'Proveedor De Prueba');
insert into purchase_orders (id, supplier_id, created_by, status)
values (
  '40000000-0000-0000-0000-00000000000a',
  '40000000-0000-0000-0000-000000000009',
  '40000000-0000-0000-0000-000000000005',
  'ordered'
);
insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, subtotal)
values (
  '40000000-0000-0000-0000-00000000000a',
  '40000000-0000-0000-0000-000000000004',
  1, 30, 30
);

-- Datos derivados del producto limpio: deben irse solos con él.
insert into supplier_product_aliases (supplier_id, ticket_text, product_id)
values (
  '40000000-0000-0000-0000-000000000009',
  'producto duplicado por error',
  '40000000-0000-0000-0000-000000000002'
);

-- ── Como administrador de local ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000006';
set local request.jwt.claims = '{"sub": "40000000-0000-0000-0000-000000000006", "role": "authenticated"}';

select throws_like(
  $$select delete_product('40000000-0000-0000-0000-000000000002')$$,
  '%propietario%',
  'Un administrador de local no puede borrar un producto (solo desactivar)'
);

-- ── Como owner ────────────────────────────────────────────────────────
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000005';
set local request.jwt.claims = '{"sub": "40000000-0000-0000-0000-000000000005", "role": "authenticated"}';

select throws_like(
  $$select delete_product('40000000-0000-0000-0000-000000000003')$$,
  '%ya tiene historia%',
  'No se borra un producto que ya se vendió'
);

select is(
  (select count(*)::int from products where id = '40000000-0000-0000-0000-000000000003'),
  1,
  'El producto con ventas sigue ahí después del intento'
);

select throws_like(
  $$select delete_product('40000000-0000-0000-0000-000000000004')$$,
  '%ya tiene historia%',
  'No se borra un producto que ya se compró'
);

select throws_like(
  $$select delete_product('40000000-0000-0000-0000-0000000000ff')$$,
  '%no encontrado%',
  'Un id que no existe da un error claro, no un borrado silencioso'
);

select lives_ok(
  $$select delete_product('40000000-0000-0000-0000-000000000002')$$,
  'Sí se borra un producto que nunca operó'
);

select is(
  (select count(*)::int from products where id = '40000000-0000-0000-0000-000000000002'),
  0,
  'El producto sin historia ya no está'
);

select is(
  (select count(*)::int from supplier_product_aliases
   where product_id = '40000000-0000-0000-0000-000000000002'),
  0,
  'Sus equivalencias de proveedor se van con él (dato derivado)'
);

-- Y lo que sí importaba sigue intacto.
select is(
  (select count(*)::int from sale_items
   where product_id = '40000000-0000-0000-0000-000000000003'),
  1,
  'La venta del otro producto no se tocó'
);

select * from finish();
rollback;
