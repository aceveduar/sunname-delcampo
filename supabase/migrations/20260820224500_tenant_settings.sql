-- El nombre del negocio ("Del Campo") estaba escrito a mano en el
-- ticket y en textos internos por toda la app -- funciona para un
-- piloto de un solo tenant, pero no para el objetivo real del
-- proyecto (CLAUDE.md §1: un sistema que sirva a varios negocios
-- distintos). El ticket es lo único que de verdad necesita el nombre
-- del negocio (es lo que ve el cliente final, CLAUDE.md §7) -- el
-- chrome interno se vuelve genérico en el código, no necesita esta
-- tabla.

create table tenant_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Mi Negocio',
  updated_at timestamptz not null default now()
);

comment on table tenant_settings is 'Configuración de identidad del negocio (fila única) -- lo que ve el cliente final en tickets/etiquetas, no el chrome interno del sistema.';

create trigger tenant_settings_set_updated_at
  before update on tenant_settings
  for each row execute function set_updated_at();

insert into tenant_settings (business_name) values ('Del Campo');

alter table tenant_settings enable row level security;

create policy tenant_settings_select on tenant_settings for select
  to authenticated using (true);

create policy tenant_settings_write on tenant_settings for update
  to authenticated
  using (current_role_key() = 'owner')
  with check (current_role_key() = 'owner');

grant select, update on tenant_settings to authenticated;
grant select, update on tenant_settings to service_role;
