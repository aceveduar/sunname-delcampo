-- Movimientos inmutables; únicamente la RPC puede registrar efectivo.
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null unique,
  cash_session_id uuid not null references public.cash_sessions(id),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000000),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid not null references public.profiles(id),
  actor_name text not null,
  created_at timestamptz not null default now()
);
create index cash_movements_session_history_idx
  on public.cash_movements(cash_session_id, created_at desc, id desc);
alter table public.cash_movements enable row level security;
create policy cash_movements_read on public.cash_movements for select to authenticated
  using (public.current_role_key() in ('owner', 'local_admin', 'cashier'));
revoke all on public.cash_movements from anon, authenticated;
grant select on public.cash_movements to authenticated;

-- Conserva el orden de columnas de la vista existente; añade entradas/salidas.
create or replace view public.cash_session_balances with (security_invoker = true) as
select c.id, c.opening_amount,
  coalesce(p.cash_sales, 0)::numeric(12,2) as cash_sales,
  (c.opening_amount + coalesce(p.cash_sales, 0) + coalesce(m.cash_in, 0) - coalesce(m.cash_out, 0))::numeric(12,2) as expected_amount,
  coalesce(m.cash_in, 0)::numeric(12,2) as cash_in,
  coalesce(m.cash_out, 0)::numeric(12,2) as cash_out
from public.cash_sessions c
left join (
  select s.cash_session_id, sum(sp.amount) as cash_sales
  from public.sales s
  join public.sale_payments sp on sp.sale_id = s.id
  join public.payment_methods pm on pm.id = sp.payment_method_id
  where s.status = 'completed' and pm.code = 'cash'
  group by s.cash_session_id
) p on p.cash_session_id = c.id
left join (
  select cash_session_id,
    sum(amount) filter (where direction = 'in') as cash_in,
    sum(amount) filter (where direction = 'out') as cash_out
  from public.cash_movements group by cash_session_id
) m on m.cash_session_id = c.id;

create function public.record_cash_movement(
  p_client_uuid uuid, p_session_id uuid, p_direction text, p_amount numeric, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := current_role_key();
  v_session cash_sessions%rowtype;
  v_previous cash_movements%rowtype;
  v_id uuid;
  v_expected numeric;
begin
  if auth.uid() is null or v_role is null or v_role not in ('owner','local_admin','cashier') then
    raise exception 'No autorizado para registrar efectivo';
  end if;
  if p_client_uuid is null then raise exception 'Falta el identificador de solicitud'; end if;
  if p_direction is null or p_direction not in ('in','out') then raise exception 'Tipo de movimiento inválido'; end if;
  if p_amount is null or not (p_amount > 0 and p_amount < 10000000000)
    or p_amount <> round(p_amount,2) then raise exception 'Ingresa un importe positivo en centavos'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Escribe un motivo de hasta 500 caracteres';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_uuid::text,0));
  select * into v_previous from cash_movements where client_uuid = p_client_uuid;
  if found then
    if v_previous.created_by = auth.uid() and v_previous.cash_session_id = p_session_id
      and v_previous.direction = p_direction and v_previous.amount = p_amount
      and v_previous.reason = btrim(p_reason) then return v_previous.id; end if;
    raise exception 'La solicitud ya se utilizó con otros datos';
  end if;
  -- Mismo bloqueo que ventas y cierre: el saldo se consulta después de obtenerlo.
  select * into v_session from cash_sessions where id = p_session_id for update;
  if not found then raise exception 'Caja no encontrada'; end if;
  if v_role = 'cashier' and v_session.opened_by <> auth.uid() then
    raise exception 'Solo puedes registrar efectivo en tu propia caja';
  end if;
  if v_session.status <> 'open' then raise exception 'La caja ya está cerrada'; end if;
  select expected_amount into v_expected from cash_session_balances where id = p_session_id;
  if p_direction = 'out' and p_amount > v_expected then
    raise exception 'La salida supera el efectivo esperado. Actualiza el resumen';
  end if;
  insert into cash_movements(client_uuid,cash_session_id,direction,amount,reason,created_by,actor_name)
  values (p_client_uuid,p_session_id,p_direction,p_amount,btrim(p_reason),auth.uid(),
    coalesce((select nullif(btrim(full_name),'') from profiles where id=auth.uid()),'Usuario'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_cash_movement(uuid,uuid,text,numeric,text) from public;
grant execute on function public.record_cash_movement(uuid,uuid,text,numeric,text) to authenticated;
