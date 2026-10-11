import { PageHeader } from '@/components/PageHeader'
import { UsersRound } from 'lucide-react'
import { LoadError } from '@/components/LoadError'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Database } from '@/lib/database.types'
import { ROLE_LABELS } from '@/lib/roles'
import { useAsyncAction } from '@/lib/useAsyncAction'
import { UserNameForm } from './UserNameForm'
import { InviteUserDialog } from './InviteUserDialog'
import { useProfiles, type Profile } from './useProfiles'

type Role = Database['public']['Enums']['user_role']

const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const {
    profiles,
    loading,
    error,
    refresh,
    updateRole,
    updateFullName,
    toggleActive,
  } = useProfiles()
  const [editingName, setEditingName] = useState<Profile | null>(null)
  const currentUserRole =
    profiles.find((p) => p.id === currentUserId)?.role ?? null

  // Un administrador de local solo gestiona cajeros (CLAUDE.md §6) -- el
  // servidor ya lo exige (trigger prevent_self_role_escalation), pero
  // ofrecerle aquí un selector que de todos modos va a rechazar cualquier
  // cambio es peor que no mostrarlo: se ve como una función rota.
  const canEditRoles = currentUserRole === 'owner'

  // Mismo patrón que anular una venta (ReportsPage.tsx): un clic no debe
  // bastar para un cambio de acceso -- ya no es la única barrera contra
  // un escalamiento de rol (eso lo bloquea el servidor), pero sigue
  // siendo fácil desactivar o cambiar de rol a alguien por accidente.
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    profile: Profile
    role: Role
  } | null>(null)
  const roleAction = useAsyncAction(
    'No se pudo cambiar el rol. Inténtalo de nuevo.',
  )
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null)
  const activeAction = useAsyncAction(
    'No se pudo cambiar el estado. Inténtalo de nuevo.',
  )

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return
    const ok = await roleAction.run(() =>
      updateRole(roleChangeTarget.profile.id, roleChangeTarget.role),
    )
    if (ok) setRoleChangeTarget(null)
  }

  const handleConfirmToggleActive = async () => {
    if (!toggleTarget) return
    const ok = await activeAction.run(() => toggleActive(toggleTarget))
    if (ok) setToggleTarget(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <LoadError message={error} onRetry={refresh} loading={loading} />
      <PageHeader
        icon={UsersRound}
        title="Usuarios"
        description="Organiza tu equipo y sus permisos de acceso."
        actions={
          <div className="self-start">
            <InviteUserDialog
              onInvited={refresh}
              currentUserRole={currentUserRole}
            />
          </div>
        }
      />

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
          {!loading && !error && profiles.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
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
                  {isSelf && (
                    <span className="text-muted-foreground"> (tú)</span>
                  )}
                </TableCell>
                <TableCell>
                  {canEditRoles ? (
                    <Select
                      items={ROLE_ITEMS}
                      value={profile.role}
                      onValueChange={(value) => {
                        if (!value) return
                        roleAction.clearError()
                        setRoleChangeTarget({ profile, role: value as Role })
                      }}
                      disabled={isSelf}
                    >
                      <SelectTrigger
                        className="w-48"
                        size="sm"
                        aria-label={`Rol de ${profile.full_name}`}
                      >
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
                  ) : (
                    <Badge variant="secondary">
                      {ROLE_LABELS[profile.role]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={profile.active ? 'default' : 'secondary'}>
                    {profile.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingName(profile)}
                  >
                    Editar nombre
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      isSelf || (!canEditRoles && profile.role !== 'cashier')
                    }
                    onClick={() => {
                      activeAction.clearError()
                      setToggleTarget(profile)
                    }}
                  >
                    {profile.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {editingName && (
        <UserNameForm
          key={editingName.id}
          initialName={editingName.full_name}
          onSave={(name) => updateFullName(editingName.id, name)}
          onClose={() => setEditingName(null)}
        />
      )}

      <ConfirmDialog
        open={roleChangeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !roleAction.pendingRef.current) setRoleChangeTarget(null)
        }}
        title="Cambiar rol"
        description={
          <>
            {roleChangeTarget &&
              `¿Cambiar el rol de ${roleChangeTarget.profile.full_name} a "${ROLE_LABELS[roleChangeTarget.role]}"?`}
            {roleAction.error && (
              <p role="alert" className="text-destructive mt-2">
                {roleAction.error}
              </p>
            )}
          </>
        }
        confirmLabel="Cambiar rol"
        confirmingLabel="Cambiando…"
        confirming={roleAction.pending}
        onConfirm={handleConfirmRoleChange}
      />

      <ConfirmDialog
        open={toggleTarget !== null}
        onOpenChange={(open) => {
          if (!open && !activeAction.pendingRef.current) setToggleTarget(null)
        }}
        title={toggleTarget?.active ? 'Desactivar usuario' : 'Activar usuario'}
        description={
          <>
            {toggleTarget &&
              `¿${toggleTarget.active ? 'Desactivar' : 'Activar'} a ${toggleTarget.full_name}?`}
            {activeAction.error && (
              <p role="alert" className="text-destructive mt-2">
                {activeAction.error}
              </p>
            )}
          </>
        }
        confirmLabel={toggleTarget?.active ? 'Desactivar' : 'Activar'}
        confirmingLabel="Guardando…"
        variant={toggleTarget?.active ? 'destructive' : 'default'}
        confirming={activeAction.pending}
        onConfirm={handleConfirmToggleActive}
      />
    </div>
  )
}
