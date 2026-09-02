-- Segunda pieza de la cáscara de CFDI. docs/investigacion-cfdi.md ya
-- concluyó que para un negocio de mostrador como Del Campo lo que
-- aplica es la factura global por corte de caja (RFC genérico
-- XAXX010101000, dentro de 72h del cierre), no factura individual por
-- venta -- encaja natural con cash_sessions, que ya existe.
--
-- Esta migración NO conecta ningún PAC todavía (no hay contrato ni
-- CSD real). request_global_invoice() solo valida las condiciones y dej
-- la solicitud en 'pending' -- el paso que de verdad timbra (llamar al
-- PAC, guardar uuid_fiscal/xml/pdf) es una función aparte a construir
-- cuando el negocio tenga sus datos fiscales listos y se elija un PAC.
-- No se simula un timbrado falso: eso confundiría más de lo que ayuda.

create type fiscal_invoice_status as enum ('pending', 'stamped', 'error', 'cancelled');

create table fiscal_invoices (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null unique references cash_sessions (id),
  status fiscal_invoice_status not null default 'pending',
  total numeric(12, 2) not null,
  requested_by uuid not null references profiles (id),
  requested_at timestamptz not null default now(),
  pac_provider text,
  pac_invoice_id text,
  uuid_fiscal text,
  xml_url text,
  pdf_url text,
  error_message text
);

comment on table fiscal_invoices is 'Una factura global por corte de caja (CLAUDE.md, investigación CFDI 2026-09-01). status=pending hasta que exista integración real con un PAC; esta tabla no se actualiza desde el cliente, solo por request_global_invoice() y, a futuro, la función que sí timbra.';

create index fiscal_invoices_status_idx on fiscal_invoices (status);

alter table fiscal_invoices enable row level security;

create policy fiscal_invoices_select on fiscal_invoices for select
  to authenticated using (current_role_key() in ('owner', 'local_admin'));

grant select on fiscal_invoices to authenticated;
grant select on fiscal_invoices to service_role;
grant insert, update on fiscal_invoices to service_role;

-- security definer: ni siquiera owner/local_admin tiene grant directo
-- de insert -- misma razón que create_sale con inventory_movements,
-- todas las validaciones de negocio viven en un solo lugar.
create function request_global_invoice(p_cash_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_session_status cash_session_status;
  v_fiscal tenant_fiscal_settings%rowtype;
  v_billing_enabled boolean;
  v_total numeric(12, 2);
  v_invoice_id uuid;
begin
  v_caller_role := current_role_key();
  if v_caller_role not in ('owner', 'local_admin') then
    raise exception 'No autorizado para solicitar una factura';
  end if;

  select enabled into v_billing_enabled from tenant_modules where module_key = 'billing';
  if coalesce(v_billing_enabled, false) is false then
    raise exception 'El módulo de Facturación no está activo';
  end if;

  select status into v_session_status from cash_sessions where id = p_cash_session_id;
  if v_session_status is null then
    raise exception 'Corte de caja % no encontrado', p_cash_session_id;
  end if;
  if v_session_status <> 'closed' then
    raise exception 'El corte de caja debe estar cerrado para facturarlo';
  end if;

  if exists (select 1 from fiscal_invoices where cash_session_id = p_cash_session_id) then
    raise exception 'Ya existe una factura para este corte de caja';
  end if;

  select * into v_fiscal from tenant_fiscal_settings where id = 1;
  if v_fiscal.rfc is null or v_fiscal.legal_name is null
    or v_fiscal.regimen_fiscal is null or v_fiscal.postal_code is null
  then
    raise exception 'Completa los datos fiscales del negocio antes de facturar';
  end if;

  select coalesce(sum(total), 0) into v_total
  from sales
  where cash_session_id = p_cash_session_id and status = 'completed';

  if v_total <= 0 then
    raise exception 'Este corte de caja no tiene ventas que facturar';
  end if;

  insert into fiscal_invoices (cash_session_id, total, requested_by)
  values (p_cash_session_id, v_total, auth.uid())
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

grant execute on function request_global_invoice(uuid) to authenticated;
