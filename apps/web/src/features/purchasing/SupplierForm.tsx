import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { Supplier } from './useSuppliers'

export type SupplierValues = Pick<
  Supplier,
  'name' | 'phone' | 'email' | 'contact_name'
>
export function SupplierForm({
  supplier,
  onSave,
  onClose,
}: {
  supplier: Supplier | null
  onSave: (values: SupplierValues) => Promise<boolean>
  onClose: () => void
}) {
  const initial = {
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    contact_name: supplier?.contact_name ?? '',
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
      setError('Escribe el nombre del proveedor.')
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
        contact_name: toTitleCase(values.contact_name.trim()) || null,
      })
      if (ok) onClose()
      else
        setError(
          'No se pudo guardar. Tu captura sigue aquí; revisa la conexión e inténtalo de nuevo.',
        )
    } catch (cause) {
      reportError('No se pudo guardar el proveedor', cause)
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
            {supplier ? 'Editar proveedor' : 'Nuevo proveedor'}
          </DialogTitle>
          <DialogDescription>
            El nombre es obligatorio. Agrega un contacto para coordinar pedidos
            y entregas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={saving}>
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">Nombre</Label>
              <Input
                id="supplier-name"
                name="name"
                autoComplete="name"
                required
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-phone">Teléfono (opcional)</Label>
                <Input
                  id="supplier-phone"
                  type="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) =>
                    setValues({ ...values, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-email">Correo (opcional)</Label>
                <Input
                  id="supplier-email"
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
              <Label htmlFor="supplier-contact">
                Persona de contacto (opcional)
              </Label>
              <Input
                id="supplier-contact"
                value={values.contact_name}
                onChange={(e) =>
                  setValues({ ...values, contact_name: e.target.value })
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
                : supplier
                  ? 'Guardar cambios'
                  : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={discard}
          onOpenChange={setDiscard}
          title="¿Descartar cambios del proveedor?"
          description="Los cambios sin guardar se perderán. Cancela para seguir editando."
          confirmLabel="Descartar cambios"
          variant="destructive"
          onConfirm={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
