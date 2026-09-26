begin;
select plan(7);
insert into auth.users (id, email) values ('10000000-0000-0000-0000-000000000001','ux-minimums@example.test');
update profiles set role='owner' where id='10000000-0000-0000-0000-000000000001';
insert into units_of_measure (id,code,name) values ('10000000-0000-0000-0000-000000000002','UXTEST','Unidad prueba');
insert into products (id,name,price,unit_id) values ('10000000-0000-0000-0000-000000000003','Prueba mínimo',10,'10000000-0000-0000-0000-000000000002');
insert into cash_sessions (id,opened_by,opening_amount,status) values ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',100,'open');
insert into sales (id,client_uuid,cash_session_id,sold_by,status) values
('10000000-0000-0000-0000-000000000005',gen_random_uuid(),'10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','completed'),
('10000000-0000-0000-0000-000000000006',gen_random_uuid(),'10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','voided');
insert into sale_payments (sale_id,payment_method_id,amount) values
('10000000-0000-0000-0000-000000000005',(select id from payment_methods where code='cash'),50),
('10000000-0000-0000-0000-000000000005',(select id from payment_methods where code='card'),900),
('10000000-0000-0000-0000-000000000006',(select id from payment_methods where code='cash'),300);
update cash_sessions set status='closed' where id='10000000-0000-0000-0000-000000000004';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select lives_ok($$ insert into inventory_minimums values ('10000000-0000-0000-0000-000000000003',2.5) $$,'Owner configura mínimos');
select throws_ok($$ update inventory_minimums set minimum_quantity=-1 $$,'23514',null,'No permite mínimos negativos');
select is((select cash_sales from cash_session_balances where id='10000000-0000-0000-0000-000000000004'),50::numeric,'Excluye tarjeta y ventas anuladas');
select is((select expected_amount from cash_session_balances where id='10000000-0000-0000-0000-000000000004'),150::numeric,'Suma fondo y ventas en efectivo');
reset role;
update profiles set role='cashier' where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select minimum_quantity from inventory_minimums where product_id='10000000-0000-0000-0000-000000000003'),2.5::numeric,'Cajero consulta mínimo');
update inventory_minimums set minimum_quantity=9 where product_id='10000000-0000-0000-0000-000000000003';
select is((select minimum_quantity from inventory_minimums where product_id='10000000-0000-0000-0000-000000000003'),2.5::numeric,'Cajero no modifica mínimo');
select throws_ok($$ insert into inventory_minimums values ('10000000-0000-0000-0000-000000000009',3) $$,'42501',null,'Cajero no inserta mínimos');
reset role;
select * from finish();
rollback;
