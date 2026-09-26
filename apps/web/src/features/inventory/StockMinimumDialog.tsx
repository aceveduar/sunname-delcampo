import { useId, useState, type FormEvent } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function StockMinimumDialog({
  productId,
  name,
  minimum,
  unit,
  onSave,
}: {
  productId: string
  name: string
  minimum: number
  unit: string
  onSave: (productId: string, quantity: number) => Promise<boolean>
}) {
  const id = useId()
  const online = useOnlineStatus()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(minimum))
  const [busy, setBusy] = useState(false)
  const quantity = Number(value)
  const valid =
    value.trim() !== '' &&
    Number.isFinite(quantity) &&
    quantity >= 0 &&
    quantity < 1e9
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !online || !valid) return
    setBusy(true)
    try {
      if (await onSave(productId, quantity)) setOpen(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next)
          if (next) setValue(String(minimum))
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={'Configurar mínimo de ' + name}
          />
        }
      >
        Mínimo: {minimum} {unit}
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Mínimo de inventario</DialogTitle>
          <DialogDescription>
            {name}. Se avisará cuando la existencia sea igual o menor al mínimo.
            Usa 0 para desactivar la alerta anticipada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={id}>
              Existencia mínima ({unit || 'unidad del producto'})
            </Label>
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              min="0"
              max="999999999.999"
              step="0.001"
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !online || !valid}>
              {busy ? 'Guardando…' : 'Guardar mínimo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
