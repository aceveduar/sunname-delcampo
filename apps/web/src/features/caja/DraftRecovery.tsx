import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadError } from '@/components/LoadError'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/features/catalog/useProducts'
import { NO_CUSTOMER, useCart } from './CartContext'

export function DraftRecovery({
  products,
  ready,
}: {
  products: Product[]
  ready: boolean
}) {
  const { pendingDraft, recoverDraft, discardDraft } = useCart()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!pendingDraft) return null

  const recover = async () => {
    if (!ready || checking) return
    setChecking(true)
    setError(null)
    try {
      // Tras una recarga durante el cobro, primero se consulta si ya se registró.
      if (pendingDraft.checkoutId) {
        const result = await supabase
          .from('sales')
          .select('id')
          .eq('client_uuid', pendingDraft.checkoutId)
          .eq('cash_session_id', pendingDraft.sessionId)
          .maybeSingle()
        if (result.error) throw result.error
        if (result.data) {
          discardDraft()
          toast.info('Esta venta ya está registrada. No se volvió a cobrar.')
          return
        }
      }
      let customerId = pendingDraft.customerId ?? NO_CUSTOMER
      if (customerId !== NO_CUSTOMER) {
        const customer = await supabase
          .from('customers')
          .select('id, active')
          .eq('id', customerId)
          .maybeSingle()
        if (customer.error) throw customer.error
        if (!customer.data?.active) customerId = NO_CUSTOMER
      }
      const { omitted, repriced } = recoverDraft(products, customerId)
      toast.info(
        `Venta recuperada. Revisa el carrito antes de cobrar.${repriced ? ` ${repriced} precios actualizados.` : ''}${omitted ? ` ${omitted} productos no disponibles o con cambio de unidad se omitieron.` : ''}`,
      )
    } catch {
      setError(
        'No se pudo revisar la venta guardada. Reintenta antes de continuar.',
      )
    } finally {
      setChecking(false)
    }
  }

  return (
    <section
      aria-label="Venta pendiente"
      className="bg-card border-border mb-4 space-y-3 rounded-lg border p-4"
    >
      <h2 className="font-semibold">Hay una venta pendiente en esta pestaña</h2>
      <p className="text-muted-foreground text-sm">
        Se recuperarán los productos disponibles con sus precios actuales. Se
        revisará el cliente guardado. Vuelve a indicar el efectivo recibido.
      </p>
      {pendingDraft.checkoutId && (
        <p className="text-sm">
          Hubo un intento de cobro. Primero verificaremos si la venta ya se
          registró; descartar el borrador no anula una venta.
        </p>
      )}
      <LoadError message={error} loading={checking} onRetry={recover} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={recover} disabled={!ready || checking}>
          {checking ? 'Verificando…' : 'Recuperar venta'}
        </Button>
        <Button variant="outline" disabled={checking} onClick={discardDraft}>
          Descartar borrador
        </Button>
      </div>
    </section>
  )
}
