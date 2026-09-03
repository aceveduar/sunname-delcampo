-- Modo de texto grande: preferencia de accesibilidad por usuario (no por
-- tenant), pensada para quien ya no ve bien letra chica en pantallas chicas
-- (CLAUDE.md §14.2). Vive en profiles porque debe seguir al usuario a
-- cualquier dispositivo donde inicie sesión, no quedarse atado a un aparato.
-- Cambio aditivo, sin afectar filas existentes (default false).
alter table profiles
  add column large_text_mode boolean not null default false;

-- Ya cubierta por la política existente profiles_update_self (un usuario
-- puede actualizar su propia fila) y por el trigger
-- profiles_prevent_self_escalation, que solo bloquea auto-cambios de
-- role/active -- large_text_mode no necesita ninguna política ni ajuste
-- nuevo.
