import type { Database } from './database.types'

type Role = Database['public']['Enums']['user_role']

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  local_admin: 'Administrador de local',
  cashier: 'Cajero',
  accountant: 'Contador',
  viewer: 'Consulta',
}

export const ADMIN_ROLES: Role[] = ['owner', 'local_admin']

export function isAdminRole(role: Role | null | undefined) {
  return role != null && ADMIN_ROLES.includes(role)
}

export function isOwnerRole(role: Role | null | undefined) {
  return role === 'owner'
}
