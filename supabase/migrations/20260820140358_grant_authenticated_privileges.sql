-- RLS y GRANT son dos capas separadas en Postgres: las políticas de la
-- migración anterior nunca sirven si el rol `authenticated` no tiene de
-- entrada el permiso base sobre la tabla (error 42501, "permission denied
-- for table ..."). El dashboard de Supabase hace este GRANT solo cuando
-- creas tablas desde el Table Editor; una tabla creada por migración SQL,
-- como las nuestras, no lo recibe automáticamente.

grant usage on schema public to authenticated;

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
  public.sale_payments
to authenticated;

grant select on public.inventory_stock to authenticated;

-- Para que las tablas de los módulos que vengan (Fase 2/3: CRM, Compras,
-- Facturación) no repitan este mismo problema al primer `db push`.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
