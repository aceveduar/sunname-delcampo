-- Memoria de nombres comerciales de proveedor distintos a su razón social.
--
-- El problema: un mismo proveedor puede imprimir un nombre distinto en el
-- ticket según el día -- "El Tamaleño Prado" un día, "El Xalapeño Pagado"
-- otro, mismo proveedor real dado de alta como "Carlos Ramón Medina
-- Reina" (docs/captura-tickets-analisis.md). El aviso "¿No es este
-- proveedor?" (lib/match.ts) compara el nombre del ticket contra la razón
-- social y no encuentra ningún parecido -- aunque la persona haya elegido
-- bien. Sin recordar la decisión, ese aviso sale cada vez, y una alerta
-- que sale seguido cuando en realidad todo está bien se termina
-- ignorando, justo cuando sí haga falta.
--
-- Aquí se guarda la decisión que ya tomó una persona la primera vez que
-- confirmó una selección que no coincidía por nombre.

create table supplier_name_aliases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  -- Nombre del proveedor tal como lo leyó el ticket, normalizado (sin
  -- acentos, minúsculas, espacios colapsados) -- mismo criterio que
  -- supplier_product_aliases.ticket_text.
  ticket_text text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (supplier_id, ticket_text)
);

create index supplier_name_aliases_ticket_text_idx on supplier_name_aliases (ticket_text);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Mismo alcance que supplier_product_aliases: un cajero no toca proveedores
-- (CLAUDE.md §6).

alter table supplier_name_aliases enable row level security;

create policy supplier_name_aliases_select on supplier_name_aliases for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));
create policy supplier_name_aliases_write on supplier_name_aliases for all
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

grant select, insert, delete on supplier_name_aliases to authenticated;
