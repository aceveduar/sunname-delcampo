import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { SaveDialog } from '@/components/SaveDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { ROLE_LABELS, isAdminRole } from '@/lib/roles'
import type { Database } from '@/lib/database.types'

type Role = Database['public']['Enums']['user_role']
type InviteProps = {
  onInvited: () => void | Promise<void>
  currentUserRole: Role | null
}

export function InviteUserDialog(props: InviteProps) {
  const [open, setOpen] = useState(false)
  const allowed = isAdminRole(props.currentUserRole)
  return (
    <>
      <Button size="sm" disabled={!allowed} onClick={() => setOpen(true)}>
        <UserPlus /> Invitar usuario
      </Button>
      {open && allowed && (
        <InviteUserForm {...props} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function InviteUserForm({
  onInvited,
  currentUserRole,
  onClose,
}: InviteProps & { onClose: () => void }) {
  const [role, setRole] = useState<Role>('cashier')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const roleItems = (Object.keys(ROLE_LABELS) as Role[])
    .filter(
      (r) => r !== 'owner' && (currentUserRole === 'owner' || r === 'cashier'),
    )
    .map((r) => ({ value: r, label: ROLE_LABELS[r] }))
  const send = async () => {
    if (
      !isAdminRole(currentUserRole) ||
      !name.trim() ||
      !email.trim() ||
      !roleItems.some((item) => item.value === role)
    )
      return false
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email: email.trim(), full_name: name.trim(), role },
    })
    if (error || data?.message) {
      let detail = data?.message
      if (!detail && error?.context instanceof Response) {
        detail = (await error.context.json().catch(() => null))?.message
      }
      reportError(
        'No se pudo invitar al usuario',
        new Error(detail ?? error?.message ?? 'Respuesta inesperada'),
      )
      return false
    }
    toast.success(`Invitación enviada a ${email.trim()}`)
    // Una recarga fallida no debe ofrecer reenviar una invitación ya confirmada.
    try {
      await onInvited()
    } catch (cause) {
      reportError(
        'La invitación se envió, pero no se pudo actualizar el equipo',
        cause,
      )
    }
    return true
  }
  return (
    <SaveDialog
      title="Invitar usuario"
      description="Recibirá un correo para confirmar su cuenta y elegir una contraseña."
      dirty={!!name || !!email || role !== 'cashier'}
      onClose={onClose}
      onSave={send}
      saveLabel="Enviar invitación"
      savingLabel="Enviando…"
    >
      {(saving) => (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nombre completo</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Correo</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rol</Label>
            <Select
              items={roleItems}
              disabled={saving}
              value={role}
              onValueChange={(value) => value && setRole(value as Role)}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </SaveDialog>
  )
}
