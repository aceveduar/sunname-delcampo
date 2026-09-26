begin;
select plan(20);
insert into auth.users(id,email) values
 ('40000000-0000-0000-0000-000000000001','cash-owner@example.test'),
 ('40000000-0000-0000-0000-000000000002','cash-cashier@example.test');
update profiles set role='owner' where id='40000000-0000-0000-0000-000000000001';
update profiles set role='cashier' where id='40000000-0000-0000-0000-000000000002';
insert into cash_sessions(id,opened_by,opening_amount) values
 ('40000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',100);
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000001';
set local request.jwt.claims='{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}';
set local role authenticated;
select lives_ok($$ select record_cash_movement('40000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003','in',50,'Aportación') $$,'Registra entrada');
select lives_ok($$ select record_cash_movement('40000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','out',25,'Bolsas') $$,'Registra salida');
select is((select expected_amount from cash_session_balances where id='40000000-0000-0000-0000-000000000003'),125::numeric,'Balance incluye movimientos');
select is((select cash_in from cash_session_balances where id='40000000-0000-0000-0000-000000000003'),50::numeric,'Desglosa entradas');
select is((select cash_out from cash_session_balances where id='40000000-0000-0000-0000-000000000003'),25::numeric,'Desglosa salidas');
select lives_ok($$ select record_cash_movement('40000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','out',25,'Bolsas') $$,'Reintento idéntico permitido');
select is((select count(*) from cash_movements where cash_session_id='40000000-0000-0000-0000-000000000003'),2::bigint,'Reintento no duplica');
select throws_like($$ select record_cash_movement('40000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','out',30,'Bolsas') $$,'%otros datos%','UUID no admite cambios');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','out',126,'Retiro') $$,'%supera%','No retira más del saldo');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',0,'Aporte') $$,'%positivo%','Rechaza cero');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',1.001,'Aporte') $$,'%centavos%','No redondea importes silenciosamente');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in','NaN','Aporte') $$,'%positivo%','Rechaza NaN');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',1,'  ') $$,'%motivo%','Exige motivo');
select throws_like($$ insert into cash_movements(client_uuid,cash_session_id,direction,amount,reason,created_by,actor_name) values(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',1,'Falso',auth.uid(),'Falso') $$,'%permission denied%','No omite RPC mediante insert');
select throws_like($$ update cash_movements set amount=1 $$,'%permission denied%','Historial no se edita');
select throws_like($$ delete from cash_movements $$,'%permission denied%','Historial no se borra');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000002';
set local request.jwt.claims='{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',1,'Otra caja') $$,'%propia caja%','Cajero no opera caja ajena');
set local request.jwt.claim.sub='40000000-0000-0000-0000-000000000001';
set local request.jwt.claims='{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$ select close_cash_session('40000000-0000-0000-0000-000000000003',125,125,null) $$,'Cierre integra movimientos');
select throws_like($$ select record_cash_movement(gen_random_uuid(),'40000000-0000-0000-0000-000000000003','in',1,'Tarde') $$,'%cerrada%','No registra después del cierre');
select lives_ok($$ select record_cash_movement('40000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','out',25,'Bolsas') $$,'Confirma reintento previo aunque caja ya esté cerrada');
reset role;
select * from finish();
rollback;
