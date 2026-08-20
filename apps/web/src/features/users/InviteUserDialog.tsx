import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/lib/roles'
import type { Database } from '@/lib/database.types'

type Role = Database['public']['Enums']['user_role']

const ROLE_ITEMS = (Object.keys(ROLE_LABELS) as Role[])
  .filter((role) => role !== 'owner')
  .map((role) => ({ value: role, label: ROLE_LABELS[role] }))

export function InviteUserDialog({ onInvited }: { onInvited: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role>('cashier')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setRole('cashier')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const full_name = String(form.get('full_name') ?? '').trim()

    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, full_name, role },
    })

    setSubmitting(false)

    if (error || data?.message) {
      // El SDK solo trae un mensaje genérico en `error.message`
      // ("Edge Function returned a non-2xx status code") -- el mensaje
      // real que puso la función va en el cuerpo de la respuesta, que
      // hay que leer aparte de `error.context`.
      const detail =
        data?.message ?? (await (error as { context?: Response })?.context?.json().catch(() => null))?.message ?? error?.message
      toast.error('No se pudo invitar al usuario', { description: detail })
      return
    }

    toast.success(`Invitación enviada a ${email}`)
    setOpen(false)
    await onInvited()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus /> Invitar usuario
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Rol</Label>
            <Select
              items={ROLE_ITEMS}
              value={role}
              onValueChange={(value) => value && setRole(value as Role)}
            >
              <SelectTrigger className="w-full">
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
          </div>
          <p className="text-muted-foreground text-xs">
            Le llega un correo para que confirme su cuenta y ponga su contraseña.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
