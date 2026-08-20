-- Mismo problema que ya documentamos para `authenticated`
-- (20260820140358_grant_authenticated_privileges.sql), pero le tocó a
-- `service_role`: las tablas creadas por migración SQL no le dan
-- privilegios base a `service_role` tampoco (RLS y GRANT son capas
-- separadas; `service_role` sí evita RLS, pero igual necesita el GRANT
-- de tabla para poder tocarla). Detectado al probar en vivo el fix de
-- invite-user (Edge Function) que asigna el rol real tras invitar --
-- `ctx.supabaseAdmin` (service_role) no podía ni leer ni actualizar
-- `profiles`: "permission denied for table profiles" (42501).
--
-- Nota: las funciones SECURITY DEFINER (create_sale, void_sale, etc.)
-- nunca sufrieron esto porque corren con los privilegios de su dueño
-- (el rol de la migración), no con los de `service_role` -- este GRANT
-- es solo para Edge Functions que tocan tablas directo vía
-- ctx.supabaseAdmin, sin pasar por una función.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.profiles,
  public.tenant_modules,
  public.units_of_measure,
  public.product_categories,
  public.products,
  public.inventory_movements,
  public.cash_sessions,
  public.payment_methods,
  public.sales,
  public.sale_items,
  public.sale_payments,
  public.suppliers,
  public.purchase_orders,
  public.purchase_order_items,
  public.customers
to service_role;

grant select on public.inventory_stock, public.product_catalog to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
