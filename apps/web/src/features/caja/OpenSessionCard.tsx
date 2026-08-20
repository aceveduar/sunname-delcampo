import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OpenSessionCard({ onOpen }: { onOpen: (openingAmount: number) => Promise<boolean> }) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    const openingAmount = Number(form.get('opening_amount') ?? 0)
    await onOpen(openingAmount)
    setSubmitting(false)
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle>Abrir caja</CardTitle>
        <CardDescription>Registra el efectivo con el que arranca el turno.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opening_amount">Monto inicial</Label>
            <Input
              id="opening_amount"
              name="opening_amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={0}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
