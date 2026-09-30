import { useState, type RefObject, type ComponentProps } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MovementHistory } from './MovementHistory'
import { NewMovementDialog } from './NewMovementDialog'
import { StockMinimumDialog } from './StockMinimumDialog'
import { StockStatus } from './StockStatus'
import type { StockRow } from './useInventoryStock'

export function InventoryProductPanel({
  row,
  unit,
  minimum,
  canRegister,
  onSaveMinimum,
  onRegister,
  onClose,
  returnFocus,
}: {
  row: StockRow
  unit: string
  minimum: number | undefined
  canRegister: boolean
  onSaveMinimum: ComponentProps<typeof StockMinimumDialog>['onSave']
  onRegister: ComponentProps<typeof NewMovementDialog>['onRegister']
  returnFocus: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const [historyVersion, setHistoryVersion] = useState(0)
  const { product, quantityOnHand } = row
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        finalFocus={returnFocus}
        className="top-0 right-0 left-auto flex h-dvh max-w-full translate-x-0 translate-y-0 flex-col gap-5 overflow-y-auto rounded-none p-5 sm:max-w-xl"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl leading-snug wrap-break-word">
            {product.name}
          </DialogTitle>
          <DialogDescription className="wrap-break-word">
            {product.sku ?? 'Sin código'} · Existencias e historial del
            producto.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted/50 space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-4">
            {product.image_url && (
              <img
                src={product.image_url}
                alt=""
                className="size-16 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="text-muted-foreground text-sm">Existencia actual</p>
              <p className="text-2xl font-semibold tabular-nums">
                {quantityOnHand} {unit}
              </p>
            </div>
          </div>
          <StockStatus quantity={quantityOnHand} minimum={minimum} />
          <p className="text-muted-foreground text-sm">
            {minimum === undefined
              ? 'Mínimo no disponible.'
              : minimum === 0
                ? 'Sin alerta anticipada de mínimo.'
                : `Mínimo configurado: ${minimum} ${unit}`}
          </p>
        </div>
        {canRegister && (
          <div className="flex flex-wrap gap-2">
            <NewMovementDialog
              triggerLabel="Ajustar existencia"
              rows={[row]}
              unitCode={() => unit}
              initialProductId={product.id}
              onRegister={async (values) => {
                const saved = await onRegister(values)
                if (saved) setHistoryVersion((version) => version + 1)
                return saved
              }}
            />
            {minimum !== undefined && (
              <StockMinimumDialog
                productId={product.id}
                name={product.name}
                minimum={minimum}
                unit={unit}
                onSave={onSaveMinimum}
              />
            )}
          </div>
        )}
        <MovementHistory
          key={historyVersion}
          productId={product.id}
          unit={unit}
        />
      </DialogContent>
    </Dialog>
  )
}
