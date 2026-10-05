import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toTitleCase } from '@/lib/text'
import { reportError } from '@/lib/errors'
import type { Customer } from './useCustomers'

export type CustomerValues = Pick<
  Customer,
  'name' | 'phone' | 'email' | 'notes'
>
export function CustomerForm({
  customer,
  onSave,
  onClose,
}: {
  customer: Customer | null
  onSave: (values: CustomerValues) => Promise<boolean>
  onClose: () => void
}) {
  const initial = {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    notes: customer?.notes ?? '',
  }
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = (Object.keys(values) as (keyof typeof values)[]).some(
    (key) => values[key] !== initial[key],
  )
  const close = () => {
    if (savingRef.current) return
    if (dirty) setDiscard(true)
    else onClose()
  }
  useEffect(() => {
    if (!dirty && !saving) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, saving])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (savingRef.current) return
    if (!values.name.trim()) {
      setError('Escribe el nombre del cliente.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const ok = await onSave({
        name: toTitleCase(values.name.trim()),
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        notes: values.notes.trim() || null,
      })
      if (ok) onClose()
      else
        setError(
          'No se pudo guardar. Tu captura sigue aquí; revisa la conexión e inténtalo de nuevo.',
        )
    } catch (cause) {
      reportError('No se pudo guardar el cliente', cause)
      setError('No se pudo guardar. Tu captura sigue aquí para reintentar.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>
            {customer ? 'Editar cliente' : 'Nuevo cliente'}
          </DialogTitle>
          <DialogDescription>
            El nombre es obligatorio. Completa el contacto y las notas que te
            ayuden a atenderlo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={saving}>
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-name">Nombre</Label>
              <Input
                id="customer-name"
                name="name"
                autoComplete="name"
                required
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone">Teléfono (opcional)</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) =>
                    setValues({ ...values, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-email">Correo (opcional)</Label>
                <Input
                  id="customer-email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) =>
                    setValues({ ...values, email: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-notes">Notas (opcional)</Label>
              <Textarea
                id="customer-notes"
                value={values.notes}
                onChange={(e) =>
                  setValues({ ...values, notes: e.target.value })
                }
              />
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={close}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !values.name.trim()}>
              {saving
                ? 'Guardando…'
                : customer
                  ? 'Guardar cambios'
                  : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={discard}
          onOpenChange={setDiscard}
          title="¿Descartar cambios del cliente?"
          description="Los cambios sin guardar se perderán. Cancela para seguir editando."
          confirmLabel="Descartar cambios"
          variant="destructive"
          onConfirm={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
