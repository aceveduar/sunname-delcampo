-- Memoria de equivalencias entre lo que dice el ticket de un proveedor y
-- lo que existe en el catálogo propio.
--
-- El problema: el proveedor escribe para su almacén, no para tu catálogo.
-- Dice "ARROZ SAMAN C/25 KG" donde tú tienes "Arroz Saman", y "CHILE
-- PULLA HERRADURA" donde tú tienes "Chile Puya". El emparejado por
-- parecido resuelve una parte, pero se equivoca en los nombres que no se
-- parecen y no aprende: el mes que viene vuelve a fallar igual.
--
-- Aquí se guarda la decisión que ya tomó una persona, para no volver a
-- preguntarla. La primera captura de un proveedor es a mano; a partir de
-- la segunda, sus tickets se llenan prácticamente solos.
--
-- Guarda además la conversión de empaque. El negocio compra por bulto y
-- vende por kilo o por gramos: el ticket dice "1 BULTO $412.50" y lo que
-- debe entrar al inventario son "25 KG a $16.50". units_per_package es
-- ese 25, y NO se le pide a nadie configurarlo -- se deduce de lo que la
-- persona capturó la primera vez (25 kg donde el ticket decía 1 bulto).

create table supplier_product_aliases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers (id) on delete cascade,
  -- Texto del ticket ya normalizado por el cliente (sin acentos, en
  -- minúsculas, espacios colapsados) para poder buscarlo exacto sin
  -- depender de cómo lo escribió el proveedor esa vez.
  ticket_text text not null,
  -- La clave del proveedor, cuando el ticket la trae. Es más estable que
  -- la descripción, así que se busca primero por aquí.
  supplier_code text,
  product_id uuid not null references products (id) on delete cascade,
  -- Cuántas unidades del producto trae una unidad del ticket.
  -- 1 BULTO = 25 KG -> 25. Sin conversión -> 1.
  units_per_package numeric(12, 3) not null default 1
    check (units_per_package > 0),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, ticket_text)
);

-- La clave del proveedor solo es única cuando existe: la mayoría de los
-- tickets de central de abastos no la traen.
create unique index supplier_product_aliases_code_idx
  on supplier_product_aliases (supplier_id, supplier_code)
  where supplier_code is not null;

create index supplier_product_aliases_product_id_idx
  on supplier_product_aliases (product_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Mismo alcance que el resto de Compras: un cajero no toca proveedores ni
-- costos (CLAUDE.md §6).

alter table supplier_product_aliases enable row level security;

create policy supplier_product_aliases_select on supplier_product_aliases for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));
create policy supplier_product_aliases_write on supplier_product_aliases for all
  to authenticated
  using (current_role_key() in ('owner', 'local_admin'))
  with check (current_role_key() in ('owner', 'local_admin'));

grant select, insert, update, delete on supplier_product_aliases to authenticated;
