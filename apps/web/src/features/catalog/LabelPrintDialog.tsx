import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
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
import { formatCurrency } from '@/lib/currency'
import type { Product } from './useProducts'

const MAX_LABELS = 100

// Productos a granel (chiles, moles, semillas) no traen un código de barras
// de fábrica -- si el producto no tiene SKU, se genera uno interno corto
// (solo dígitos, sin ambigüedad para ningún lector) para poder imprimir su
// etiqueta.
function generateInternalCode() {
  return (
    Date.now().toString().slice(-8) +
    String(Math.floor(Math.random() * 90) + 10)
  )
}

function BarcodeLabel({
  name,
  sku,
  priceLabel,
}: {
  name: string
  sku: string
  priceLabel: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    JsBarcode(svgRef.current, sku, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 12,
      height: 36,
      margin: 4,
    })
  }, [sku])

  return (
    <div className="border-border bg-card flex flex-col items-center gap-1 overflow-hidden rounded-md border p-2 text-center">
      <p className="w-full truncate text-xs font-medium">{name}</p>
      <p className="text-xs font-semibold">{priceLabel}</p>
      <svg ref={svgRef} className="h-auto w-full" />
    </div>
  )
}

export function LabelPrintDialog({
  product,
  onOpenChange,
  onAssignSku,
}: {
  product: Product | null
  onOpenChange: (open: boolean) => void
  onAssignSku: (id: string, sku: string) => Promise<boolean>
}) {
  const [quantity, setQuantity] = useState(1)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    setQuantity(1)
  }, [product?.id])

  if (!product) return null

  const priceLabel = product.sold_by_weight
    ? `${formatCurrency(product.price)}/kg`
    : formatCurrency(product.price)

  const handleGenerateCode = async () => {
    setAssigning(true)
    await onAssignSku(product.id, generateInternalCode())
    setAssigning(false)
  }

  const copies = Math.min(MAX_LABELS, Math.max(1, quantity))

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Etiqueta — {product.name}</DialogTitle>
        </DialogHeader>

        {!product.sku ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Este producto no tiene un código asignado — normal en
              productos a granel, que no traen uno de fábrica. Genera uno
              interno para poder imprimir su etiqueta.
            </p>
            <Button onClick={handleGenerateCode} disabled={assigning}>
              {assigning ? 'Generando…' : 'Generar código'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label-quantity">Cantidad de etiquetas</Label>
              <Input
                id="label-quantity"
                type="number"
                min={1}
                max={MAX_LABELS}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                autoComplete="off"
              />
            </div>

            <div
              data-print-area
              className="border-border bg-muted/30 max-h-72 overflow-y-auto rounded-md border p-3 print:max-h-none print:overflow-visible print:border-0 print:bg-transparent print:p-0"
            >
              <div className="grid grid-cols-2 gap-2 print:grid-cols-3">
                {Array.from({ length: copies }).map((_, index) => (
                  <BarcodeLabel
                    key={index}
                    name={product.name}
                    sku={product.sku!}
                    priceLabel={priceLabel}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          {product.sku && (
            <Button onClick={() => window.print()}>Imprimir</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
