-- Pruebas de receive_purchase_order().
--
-- Lo que de verdad se está cuidando aquí es el costo: desde el
-- 2026-09-03 recibir una orden también actualiza products.cost, que es
-- lo que alimenta el margen en Reportes y lo que la captura de compras
-- por foto viene a llenar. Antes esa actualización no existía, así que
-- sin prueba nada evitaría que se pierda otra vez en una migración.
begin;
select plan(7);

-- ── Fixtures ──────────────────────────────────────────────────────────
insert into units_of_measure (id, code, name)
values ('20000000-0000-0000-0000-000000000001', 'KG', 'Kilogramo');

-- Producto con costo previo: se espera que la compra nueva lo reemplace.
insert into products (id, name, price, cost, unit_id)
values (
  '20000000-0000-0000-0000-000000000002',
  'Chile de prueba',
  200.00, 90.00,
  '20000000-0000-0000-0000-000000000001'
);

-- Producto con costo previo que llega en una línea sin costo capturado:
-- se espera que conserve el costo viejo, no que se ponga en cero.
insert into products (id, name, price, cost, unit_id)
values (
  '20000000-0000-0000-0000-000000000003',
  'Mole de prueba',
  300.00, 150.00,
  '20000000-0000-0000-0000-000000000001'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '20000000-0000-0000-0000-000000000004',
  'owner-compras@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);
update profiles set role = 'owner' where id = '20000000-0000-0000-0000-000000000004';

insert into suppliers (id, name)
values ('20000000-0000-0000-0000-000000000005', 'Proveedor de prueba');

insert into purchase_orders (id, supplier_id, created_by, status)
values (
  '20000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000004',
  'ordered'
);

insert into purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, subtotal)
values
  (
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    25, 16.50, 412.50
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000003',
    10, 0, 0
  );

-- ── Como owner ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub": "20000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select lives_ok(
  $$select receive_purchase_order('20000000-0000-0000-0000-000000000006')$$,
  'Un owner puede recibir una orden en estado ordered'
);

select is(
  (select status::text from purchase_orders where id = '20000000-0000-0000-0000-000000000006'),
  'received',
  'La orden queda en estado received'
);

select is(
  (select cost from products where id = '20000000-0000-0000-0000-000000000002'),
  16.50::numeric,
  'El costo del catálogo se actualiza con el costo de esta compra'
);

select is(
  (select cost from products where id = '20000000-0000-0000-0000-000000000003'),
  150.00::numeric,
  'Un costo en cero no borra el costo anterior del producto'
);

select is(
  (
    select quantity from inventory_movements
    where product_id = '20000000-0000-0000-0000-000000000002'
      and reference_id = '20000000-0000-0000-0000-000000000006'
  ),
  25::numeric,
  'La recepción registra la entrada de inventario por la cantidad comprada'
);

select is(
  (
    select count(*)::int from inventory_movements
    where reference_id = '20000000-0000-0000-0000-000000000006' and type = 'in'
  ),
  2,
  'Se registra un movimiento de entrada por cada línea de la orden'
);

-- Recibir dos veces duplicaría el inventario y volvería a mover el costo.
select throws_like(
  $$select receive_purchase_order('20000000-0000-0000-0000-000000000006')$$,
  '%ordered%',
  'Una orden ya recibida no se puede recibir de nuevo'
);

select * from finish();
rollback;
