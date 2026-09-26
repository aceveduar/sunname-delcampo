-- Mínimos compartidos entre equipos, sin exponer costos del catálogo.
create table public.inventory_minimums (
  product_id uuid primary key references public.products(id) on delete cascade,
  minimum_quantity numeric(12,3) not null check (minimum_quantity >= 0)
);
alter table public.inventory_minimums enable row level security;
create policy inventory_minimums_read on public.inventory_minimums
  for select to authenticated using (true);
create policy inventory_minimums_write on public.inventory_minimums
  for all to authenticated
  using (public.current_role_key() in ('owner', 'local_admin'))
  with check (public.current_role_key() in ('owner', 'local_admin'));
grant select, insert, update, delete on public.inventory_minimums to authenticated;

-- Agregación en servidor: no depende del límite de filas de PostgREST.
create view public.cash_session_balances with (security_invoker = true) as
select c.id, c.opening_amount,
  coalesce(p.cash_sales, 0)::numeric(12,2) as cash_sales,
  (c.opening_amount + coalesce(p.cash_sales, 0))::numeric(12,2) as expected_amount
from public.cash_sessions c
left join (
  select s.cash_session_id, sum(sp.amount) as cash_sales
  from public.sales s
  join public.sale_payments sp on sp.sale_id = s.id
  join public.payment_methods pm on pm.id = sp.payment_method_id
  where s.status = 'completed' and pm.code = 'cash'
  group by s.cash_session_id
) p on p.cash_session_id = c.id;
grant select on public.cash_session_balances to authenticated;
