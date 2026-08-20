import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/lib/database.types'
import { ROLE_LABELS } from '@/lib/roles'
import { useProfiles } from './useProfiles'

type Role = Database['public']['Enums']['user_role']

const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const { profiles, loading, updateRole, toggleActive } = useProfiles()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Usuarios</h1>
        <p className="text-muted-foreground text-sm">
          Roles y acceso del equipo de Del Campo.
        </p>
      </div>

      <div className="border-border bg-card rounded-lg border p-3 text-sm">
        Para dar de alta a alguien nuevo, todavía se hace desde el dashboard de Supabase
        (Authentication → Users → Add user). Aquí puedes cambiar el rol o desactivar a quien ya
        tiene cuenta.
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!loading && profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                No hay usuarios todavía.
              </TableCell>
            </TableRow>
          )}
          {profiles.map((profile) => {
            const isSelf = profile.id === currentUserId
            return (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">
                  {profile.full_name}
                  {isSelf && <span className="text-muted-foreground"> (tú)</span>}
                </TableCell>
                <TableCell>
                  <Select
                    items={ROLE_ITEMS}
                    value={profile.role}
                    onValueChange={(value) => value && updateRole(profile.id, value as Role)}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-48" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={profile.active ? 'default' : 'secondary'}>
                    {profile.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSelf}
                    onClick={() => toggleActive(profile)}
                  >
                    {profile.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
