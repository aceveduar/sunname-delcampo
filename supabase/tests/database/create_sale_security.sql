-- Pruebas de seguridad para create_sale/RLS -- cubren los hallazgos
-- confirmados en la auditoría del 2026-08-20 (ver CLAUDE.md §15) para
-- que una migración futura no pueda reintroducirlos sin que CI lo
-- atrape. Ya pasó una vez: una migración del mismo día reintrodujo
-- brevemente el bug del precio forjado, sobreescrita horas después por
-- la migración que sí lo corrige -- sin esta prueba, nada lo hubiera
-- detectado automáticamente.
begin;
select plan(9);

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

select * from finish();
rollback;
