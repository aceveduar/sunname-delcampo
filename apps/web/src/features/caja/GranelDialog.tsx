import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { granelTotalFromWeightKg, granelWeightKgFromAmount } from '@/lib/granel'
import type { Product } from '@/features/catalog/useProducts'

export function GranelDialog({
  product,
  onConfirm,
  onOpenChange,
}: {
  product: Product | null
  onConfirm: (weightKg: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const [grams, setGrams] = useState('')
  const [amount, setAmount] = useState('')

  if (!product) return null

  const pricePerKg = product.price
  const pricePer100g = product.price_per_100g ?? 0

  const weightFromGrams = Number(grams || 0) / 1000
  const totalFromGrams =
    weightFromGrams > 0 ? granelTotalFromWeightKg(weightFromGrams, pricePerKg, pricePer100g) : 0

  const weightFromAmount =
    Number(amount || 0) > 0
      ? granelWeightKgFromAmount(Number(amount), pricePerKg, pricePer100g)
      : 0

  const handleConfirmGrams = () => {
    if (weightFromGrams <= 0) return
    onConfirm(weightFromGrams)
    reset()
  }

  const handleConfirmAmount = () => {
    if (weightFromAmount <= 0) return
    onConfirm(weightFromAmount)
    reset()
  }

  const reset = () => {
    setGrams('')
    setAmount('')
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) reset()
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          {formatCurrency(pricePerKg)}/kg · {formatCurrency(pricePer100g)}/100g (menos de 1kg)
        </p>

        <Tabs defaultValue="peso">
          <TabsList className="w-full">
            <TabsTrigger value="peso" className="flex-1">
              Por peso
            </TabsTrigger>
            <TabsTrigger value="monto" className="flex-1">
              Por monto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="peso" className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="granel-grams">Gramos pedidos (báscula)</Label>
              <Input
                id="granel-grams"
                type="number"
                min="1"
                step="1"
                autoFocus
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
                placeholder="130"
              />
            </div>
            <p className="text-sm font-medium">
              Total: {formatCurrency(totalFromGrams)}
            </p>
            <Button onClick={handleConfirmGrams} disabled={weightFromGrams <= 0}>
              Agregar
            </Button>
          </TabsContent>

          <TabsContent value="monto" className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="granel-amount">Monto pedido por el cliente</Label>
              <Input
                id="granel-amount"
                type="number"
                min="1"
                step="0.5"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="20"
              />
            </div>
            <p className="text-sm font-medium">
              Peso a pesar: {Math.round(weightFromAmount * 1000)} g
            </p>
            <Button onClick={handleConfirmAmount} disabled={weightFromAmount <= 0}>
              Agregar
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}
