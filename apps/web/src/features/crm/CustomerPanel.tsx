import type { ReactNode } from 'react'
import { Mail, Phone, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Customer } from './useCustomers'

export function CustomerPanel({
  customer,
  onClose,
  onEdit,
  children,
}: {
  customer: Customer
  onClose: () => void
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="top-0 right-0 left-auto flex h-dvh max-w-full translate-x-0 translate-y-0 flex-col gap-5 overflow-y-auto rounded-none p-5 sm:max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl leading-snug wrap-break-word">
            {customer.name}
          </DialogTitle>
          <DialogDescription>
            Datos y compras asociadas a este cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/40 space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="outline">
              {customer.active ? 'Activo' : 'Inactivo'}
            </Badge>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-4" />
              Editar datos
            </Button>
          </div>
          <p className="flex items-center gap-2 text-sm">
            <Phone
              aria-hidden
              className="text-muted-foreground size-4 shrink-0"
            />
            <span className="break-all">
              {customer.phone || 'Sin teléfono'}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <Mail
              aria-hidden
              className="text-muted-foreground size-4 shrink-0"
            />
            <span className="break-all">{customer.email || 'Sin correo'}</span>
          </p>
          <div className="border-t pt-3">
            <p className="mb-1 text-sm font-medium">Notas</p>
            <p className="text-muted-foreground text-sm wrap-break-word whitespace-pre-wrap">
              {customer.notes || 'Sin notas todavía.'}
            </p>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}
