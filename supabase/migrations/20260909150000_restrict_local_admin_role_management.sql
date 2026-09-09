-- CRÍTICO, auditoría 2026-09-09: un local_admin podía cambiar el rol de
-- CUALQUIER perfil a CUALQUIER rol -- incluido volverse owner a sí
-- mismo, o degradar al propietario real. profiles_manage_admin permite
-- el UPDATE con solo checar que quien actúa sea owner/local_admin, sin
-- restringir a qué rol ni a qué fila. El mismo alcance que ya se le dio
-- a invite-user el 2026-08-30 ("un administrador de local solo puede
-- invitar cajeros") nunca se aplicó a editar un usuario ya existente
-- desde Usuarios.
--
-- prevent_self_role_escalation ya bloqueaba que alguien SIN privilegios
-- de administrador se cambiara su propio rol/estado -- pero su condición
-- ("current_role_key() not in ('owner','local_admin')") nunca detiene a
-- un local_admin, que sí está en esa lista, cambiando su PROPIO rol.

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
declare
  v_actor_role user_role := current_role_key();
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and v_actor_role not in ('owner', 'local_admin') then
    raise exception 'No puedes cambiar tu propio rol o estado activo';
  end if;

  -- Mismo alcance que invite-user: un local_admin solo administra
  -- cajeros -- nunca a sí mismo, nunca a una fila que ya sea o vaya a
  -- ser owner/local_admin/accountant/viewer.
  if v_actor_role = 'local_admin'
     and (new.role is distinct from old.role or new.active is distinct from old.active)
     and (old.role <> 'cashier' or new.role <> 'cashier' or new.id = auth.uid()) then
    raise exception 'Un administrador de local solo puede gestionar cajeros';
  end if;

  return new;
end;
$$;
