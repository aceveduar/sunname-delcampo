-- Cáscara de Fase 4 (CFDI 4.0, CLAUDE.md §4). Lo que de verdad bloquea
-- timbrar es que el negocio tenga RFC + régimen fiscal + CSD vigente
-- ante el SAT (docs/investigacion-cfdi.md) -- eso no lo resuelve una
-- migración. Esta tabla solo captura esos datos para cuando existan,
-- así el dueño puede irlos llenando antes de que haya un PAC conectado.
-- Fila única, mismo patrón que tenant_settings.

create table tenant_fiscal_settings (
  id smallint primary key default 1 check (id = 1),
  rfc text,
  legal_name text,
  regimen_fiscal text,
  postal_code text,
  updated_at timestamptz not null default now()
);

comment on table tenant_fiscal_settings is 'Datos fiscales del negocio para CFDI 4.0 (RFC, razón social, régimen, código postal de expedición). Fila única. Todo nullable a propósito -- se llena antes de tener PAC conectado.';

create trigger tenant_fiscal_settings_set_updated_at
  before update on tenant_fiscal_settings
  for each row execute function set_updated_at();

insert into tenant_fiscal_settings (id) values (1);

alter table tenant_fiscal_settings enable row level security;

-- Admin-only, a diferencia de tenant_settings (que sí lee cualquier
-- autenticado): el RFC y la razón social son datos fiscales, no de
-- marca -- mismo criterio que ya se usó para el costo de producto.
create policy tenant_fiscal_settings_select on tenant_fiscal_settings for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));

create policy tenant_fiscal_settings_write on tenant_fiscal_settings for update
  to authenticated
  using (current_role_key() = 'owner')
  with check (current_role_key() = 'owner');

grant select, update on tenant_fiscal_settings to authenticated;
grant select, update on tenant_fiscal_settings to service_role;
