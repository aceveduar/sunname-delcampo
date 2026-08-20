import { useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { toTitleCase } from '@/lib/text'
import { InviteUserDialog } from './InviteUserDialog'
import { useProfiles, type Profile } from './useProfiles'

type Role = Database['public']['Enums']['user_role']

const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))

export function UsersPage({ currentUserId }: { currentUserId: string }) {
  const { profiles, loading, refresh, updateRole, updateFullName, toggleActive } = useProfiles()
  const [editingName, setEditingName] = useState<Profile | null>(null)

  const handleSubmitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingName) return
    const form = new FormData(event.currentTarget)
    const fullName = toTitleCase(String(form.get('full_name') ?? ''))
    if (!fullName) return
    const ok = await updateFullName(editingName.id, fullName)
    if (ok) setEditingName(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground text-sm">Roles y acceso de tu equipo.</p>
        </div>
        <InviteUserDialog onInvited={refresh} />
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
                <TableCell className="flex justify-end gap-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditingName(profile)}>
                    Editar nombre
                  </Button>
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

      <Dialog open={editingName !== null} onOpenChange={(open) => !open && setEditingName(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nombre</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitName} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-full-name">Nombre completo</Label>
              <Input
                id="edit-full-name"
                name="full_name"
                defaultValue={editingName?.full_name}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
