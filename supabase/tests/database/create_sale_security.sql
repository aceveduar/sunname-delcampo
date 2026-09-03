-- Pruebas de seguridad para create_sale/RLS -- cubren los hallazgos
-- confirmados en la auditoría del 2026-08-20 (ver CLAUDE.md §15) para
-- que una migración futura no pueda reintroducirlos sin que CI lo
-- atrape. Ya pasó una vez: una migración del mismo día reintrodujo
-- brevemente el bug del precio forjado, sobreescrita horas después por
-- la migración que sí lo corrige -- sin esta prueba, nada lo hubiera
-- detectado automáticamente.
begin;
select plan(26);

-- ── Fixtures (como el rol que corre las migraciones, sin RLS de por
-- medio) ──────────────────────────────────────────────────────────────
insert into units_of_measure (id, code, name)
values ('00000000-0000-0000-0000-00000000001a', 'KG', 'Kilogramo');

insert into products (id, name, price, unit_id, sold_by_weight, price_per_100g)
values (
  '00000000-0000-0000-0000-000000000001',
  'Producto de prueba',
  50.00,
  '00000000-0000-0000-0000-00000000001a',
  false,
  null
);

-- Producto a granel para probar el quiebre de tarifa (mismos números
-- reales que Chile Puya, 2026-09-02: $160/kg, $19/100g).
insert into products (id, name, price, unit_id, sold_by_weight, price_per_100g)
values (
  '00000000-0000-0000-0000-000000000009',
  'Producto a granel de prueba',
  160.00,
  '00000000-0000-0000-0000-00000000001a',
  true,
  19.00
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000002',
  'test-cashier@example.com',
  '{"role": "owner", "full_name": "Cajero De Prueba"}'::jsonb
);

-- Test 1 (el hallazgo CRÍTICO de la auditoría): handle_new_user() ignora
-- el rol pedido en los metadatos del signup -- antes cualquiera podía
-- autorregistrarse como 'owner' sin autenticarse.
select is(
  (select role::text from profiles where id = '00000000-0000-0000-0000-000000000002'),
  'cashier',
  'handle_new_user() crea todo perfil nuevo como cashier, sin importar el rol pedido en los metadatos del signup'
);

insert into cash_sessions (id, opened_by, opening_amount, status)
values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  0,
  'open'
);

-- ── A partir de aquí, todo corre como si fuera el cajero de prueba
-- autenticado (RLS activa de verdad) ────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

-- Test 2: un cajero no puede insertar directo en sales -- debe pasar
-- siempre por create_sale().
select throws_like(
  $$insert into sales (client_uuid, cash_session_id, sold_by, subtotal, total)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 50, 50)$$,
  '%row-level security%',
  'Un cajero no puede insertar directo en sales'
);

-- Test 3: un cajero no puede insertar directo un movimiento de
-- inventario (cerraría la puerta para encubrir merma/robo sin una
-- venta real detrás).
select throws_like(
  $$insert into inventory_movements (product_id, type, quantity, reference_type)
    values ('00000000-0000-0000-0000-000000000001', 'out', 1, 'adjustment')$$,
  '%row-level security%',
  'Un cajero no puede insertar directo en inventory_movements'
);

-- Test 4: create_sale rechaza cuando el pago no coincide con el
-- subtotal calculado del lado del servidor (nunca confía en un total
-- mandado por el cliente).
select throws_like(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000001', 'quantity', 1)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 999))
    )$$,
  '%no coinciden%',
  'create_sale rechaza cuando el pago no coincide con el subtotal real'
);

-- Test 5: create_sale calcula el precio SIEMPRE desde el catálogo,
-- ignorando cualquier precio que intente colarse en el item -- un
-- cajero forjando unit_price fue el hallazgo ALTO de la auditoría.
select is(
  (
    select (create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object(
        'product_id', '00000000-0000-0000-0000-000000000001',
        'quantity', 1,
        'unit_price', 1
      )),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 50))
    ))
  ) is not null,
  true,
  'create_sale acepta una venta correcta (precio real del catálogo, $50) aunque el item traiga un unit_price forjado de $1'
);

select is(
  (select unit_price from sale_items where product_id = '00000000-0000-0000-0000-000000000001' limit 1),
  50.00,
  'El precio guardado en sale_items es el del catálogo ($50), nunca el unit_price forjado ($1) que traía el item'
);

-- Test 7: un cajero no puede insertar directo en sale_items (reusa la
-- venta real que ya creó la Prueba 5 -- necesita un sale_id existente
-- para no confundir un error de llave foránea con el de RLS que se
-- quiere probar aquí).
select throws_like(
  $$insert into sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    values (
      (select id from sales where sold_by = '00000000-0000-0000-0000-000000000002' limit 1),
      '00000000-0000-0000-0000-000000000001',
      1, 50, 50
    )$$,
  '%row-level security%',
  'Un cajero no puede insertar directo en sale_items'
);

-- Test 8: un cajero no puede insertar directo en sale_payments.
select throws_like(
  $$insert into sale_payments (sale_id, payment_method_id, amount)
    values (
      (select id from sales where sold_by = '00000000-0000-0000-0000-000000000002' limit 1),
      (select id from payment_methods where code = 'cash'),
      50
    )$$,
  '%row-level security%',
  'Un cajero no puede insertar directo en sale_payments'
);

-- Test 9: un cajero no puede usar la caja de otro (o una ya cerrada).
select throws_like(
  $$select create_sale(
      gen_random_uuid(),
      '99999999-9999-9999-9999-999999999999',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000001', 'quantity', 1)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 50))
    )$$,
  '%no está abierta a tu nombre%',
  'create_sale rechaza una caja que no está abierta a nombre de quien llama'
);

-- Test 10 y 11 (segundo audit de seguridad, 2026-08-31): create_sale es
-- security definer y cualquier cajero autenticado puede llamarla
-- directo, sin pasar por GranelDialog (que bloquea 0 en la UI, pero eso
-- no protege la función en sí). Cantidad 0 tumbaba la función con
-- "division by zero" sin manejar en el quiebre de tarifa a granel;
-- cantidad negativa colaba un subtotal negativo que, con un pago
-- negativo a juego, sí lograba pasar la validación de pago=subtotal.
select throws_like(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000001', 'quantity', 0)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 0))
    )$$,
  '%cantidad%mayor a cero%',
  'create_sale rechaza un item con cantidad 0'
);

select throws_like(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000001', 'quantity', -1)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', -50))
    )$$,
  '%cantidad%mayor a cero%',
  'create_sale rechaza un item con cantidad negativa, aunque el pago sea negativo a juego'
);

-- ── void_sale: reusa la venta real de la Prueba 5 (Chile de prueba,
-- $50, 1 unidad) ──────────────────────────────────────────────────────

-- Test 12: un cajero no puede anular ventas (solo owner/local_admin).
select throws_like(
  $$select void_sale((select id from sales where sold_by = '00000000-0000-0000-0000-000000000002' limit 1))$$,
  '%No autorizado para anular ventas%',
  'Un cajero no puede llamar void_sale'
);

-- A partir de aquí, como owner de prueba (crear el fixture requiere
-- volver al rol sin RLS -- reset local solo afecta esta transacción).
-- Hay que limpiar también los claims del cajero: si no, auth.uid()
-- seguiría devolviendo su id y el trigger de auto-escalación de rol
-- vería a un 'cashier' intentando cambiar un rol y lo bloquearía.
reset role;
set local request.jwt.claim.sub = '';
set local request.jwt.claims = '';

insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000004',
  'test-owner@example.com',
  '{"full_name": "Owner De Prueba"}'::jsonb
);

update profiles set role = 'owner' where id = '00000000-0000-0000-0000-000000000004';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';

-- Test 13: void_sale revierte el inventario con un movimiento 'in'
-- compensatorio, sin borrar el 'out' original.
select lives_ok(
  $$select void_sale((select id from sales where sold_by = '00000000-0000-0000-0000-000000000002' limit 1))$$,
  'void_sale (como owner) anula la venta sin lanzar error'
);

select is(
  (
    select coalesce(sum(quantity), 0) from inventory_movements
    where product_id = '00000000-0000-0000-0000-000000000001' and type = 'in' and reference_type = 'sale_void'
  ),
  1::numeric,
  'void_sale repuso exactamente la cantidad vendida (1) como movimiento de entrada compensatorio'
);

-- Test 14: no se puede anular dos veces la misma venta.
select throws_like(
  $$select void_sale((select id from sales where sold_by = '00000000-0000-0000-0000-000000000002' limit 1))$$,
  '%ya está anulada%',
  'void_sale rechaza anular una venta que ya está anulada'
);

-- ── Quiebre de tarifa granel en 1/4 kg (250g), no en 1kg -- confirmado
-- con las hojas de precio reales del dueño (2026-09-02) que el cuarto
-- es siempre exacto precio_kilo ÷ 4. Bug real que motivó estas
-- pruebas: el cliente (lib/granel.ts) se corrigió a este quiebre pero
-- create_sale se quedó con el de 1kg -- como create_sale rechaza la
-- venta si el pago no coincide con lo que él mismo calcula, cualquier
-- venta a granel entre 250g y 1kg fallaba por completo hasta que se
-- corrigió aquí también (mismo día, misma sesión).

-- Test 15/16: exactamente 250g ya usa la tarifa de kilo, proporcional
-- ($160/kg × 0.25 = $40, el precio real del cuarto).
select lives_ok(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'quantity', 0.25)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 40.00))
    )$$,
  'create_sale acepta 250g de un producto a granel a $40 (tarifa de kilo, no de menudeo)'
);
select is(
  (select subtotal from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and quantity = 0.25),
  40.00,
  'sale_items guarda 250g a la tarifa de kilo proporcional ($40), no a la de menudeo'
);

-- Test 17/18: el regresivo que de verdad importa -- 400g (entre 250g y
-- 1kg) es justo el rango donde el quiebre viejo de 1kg habría cobrado
-- distinto ($76 de menudeo) que el nuevo de 250g ($64 de kilo
-- proporcional).
select lives_ok(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'quantity', 0.4)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 64.00))
    )$$,
  'create_sale acepta 400g de un producto a granel a $64 (tarifa de kilo proporcional)'
);
select is(
  (select subtotal from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and quantity = 0.4),
  64.00,
  'sale_items guarda 400g a $64 -- el quiebre viejo de 1kg hubiera dado $76 de menudeo'
);

-- Test 19/20: justo por debajo de 250g todavía es tarifa de menudeo
-- (240g × $19/100g = $45.60).
select lives_ok(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'quantity', 0.24)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 45.60))
    )$$,
  'create_sale acepta 240g de un producto a granel a $45.60 (todavía tarifa de menudeo)'
);
select is(
  (select subtotal from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and quantity = 0.24),
  45.60,
  'sale_items guarda 240g a la tarifa de menudeo, justo antes del quiebre de 250g'
);

-- ── Venta "por monto": el cliente pide "$50 de X" y el total debe ser
-- exactamente $50 (si paga con $50 no hay cambio). El peso lo deriva el
-- servidor -- el cliente nunca manda un precio, solo cuánto dinero pidió
-- el comprador. Regla confirmada con el dueño (2026-09-03).

-- Test 22/23: $50 del producto a granel de prueba ($512/kg, $60/100g).
-- $50 < $128 (un cuarto) -> tarifa de 100g -> 50/60/10 = 83.33g -> 83g.
-- El subtotal debe ser $50.00 EXACTO, no 0.083 × tarifa.
select lives_ok(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'amount', 50)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 50.00))
    )$$,
  'create_sale acepta una venta por monto de $50 pagada con $50 exactos'
);
select is(
  (select subtotal from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and quantity = 0.083),
  50.00,
  'La venta por monto cobra el monto pedido exacto ($50.00), no peso × tarifa'
);

-- Test 24: el peso derivado se guarda, para que el inventario descuente
-- lo que de verdad salió.
select is(
  (select quantity from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and subtotal = 50.00),
  0.083::numeric,
  'La venta por monto guarda el peso derivado por el servidor (83g)'
);

-- Test 25: por monto también respeta el quiebre de tarifa -- $200 ya
-- pasa los $128 de un cuarto, así que el peso sale a precio de kilo
-- (200/512 = 390.6g -> 391g), y el cobro sigue siendo el monto exacto.
select lives_ok(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'amount', 200)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 200.00))
    )$$,
  'create_sale acepta una venta por monto arriba del quiebre de tarifa'
);
select is(
  (select quantity from sale_items where product_id = '00000000-0000-0000-0000-000000000009' and subtotal = 200.00),
  0.391::numeric,
  'Arriba del quiebre, el peso por monto se deriva con la tarifa de kilo (391g)'
);

-- Test 26: un monto en cero o negativo se rechaza, igual que la
-- cantidad -- create_sale es security definer y se puede llamar directo
-- sin pasar por la UI.
select throws_like(
  $$select create_sale(
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000009', 'amount', 0)),
      jsonb_build_array(jsonb_build_object('payment_method_id', (select id from payment_methods where code = 'cash'), 'amount', 0))
    )$$,
  '%monto%mayor a cero%',
  'create_sale rechaza una venta por monto de cero'
);

select * from finish();
rollback;
