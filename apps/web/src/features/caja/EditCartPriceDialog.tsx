import { useEffect, useState, type FormEvent } from 'react'
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
import type { Product } from '@/features/catalog/useProducts'

// Corrige el precio real en Catálogo, sin salir de la venta en curso --
// nunca cobra un precio distinto al que queda guardado ahí. create_sale
// sigue tomando el precio del catálogo como siempre; esto solo hace
// rápido corregirlo cuando está mal y el cliente está esperando. Por
// diseño no existe un "precio solo para esta venta": eso mezclaría una
// corrección de catálogo con un descuento puntual, dos cosas distintas.
export function EditCartPriceDialog({
  product,
  onOpenChange,
  onSave,
}: {
  product: Product | null
  onOpenChange: (open: boolean) => void
  onSave: (
    productId: string,
    price: number,
    pricePer100g: number | null,
  ) => Promise<boolean>
}) {
  const [price, setPrice] = useState('')
  const [pricePer100g, setPricePer100g] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (product) {
      setPrice(String(product.price))
      setPricePer100g(String(product.price_per_100g ?? 0))
    }
  }, [product])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!product) return
    setSaving(true)
    const ok = await onSave(
      product.id,
      Number(price),
      product.sold_by_weight ? Number(pricePer100g) : null,
    )
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Corregir precio</DialogTitle>
        </DialogHeader>
        {product && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-muted-foreground text-sm">{product.name}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cart-price">
                Precio{product.sold_by_weight ? ' por kilo' : ''}
              </Label>
              <Input
                id="cart-price"
                type="number"
                step="0.01"
                min="0"
                autoComplete="off"
                autoFocus
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {product.sold_by_weight && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cart-price-100g">Precio por 100 g</Label>
                <Input
                  id="cart-price-100g"
                  type="number"
                  step="0.01"
                  min="0"
                  autoComplete="off"
                  value={pricePer100g}
                  onChange={(e) => setPricePer100g(e.target.value)}
                />
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Corrige el precio en Catálogo y en esta venta a la vez. Se queda así para
              las siguientes ventas también.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
