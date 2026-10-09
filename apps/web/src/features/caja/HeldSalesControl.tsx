import { useEffect, useRef, useState, type RefObject } from 'react'
import { Clock3, Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useCart } from './CartContext'
import { HELD_SALES_LIMIT, saleTotal, type HeldSale } from './heldSales'
import { HeldSaleReview } from './HeldSaleReview'
import { reviewHeldSale, type HeldSaleReview as Review } from './reviewHeldSale'
import { formatCurrency } from '@/lib/currency'

type Screen =
  | { kind: 'hold' }
  | { kind: 'list' }
  | { kind: 'review'; sale: HeldSale; review: Review }
  | { kind: 'discard'; sale: HeldSale }
export function HeldSalesControl({
  sessionId,
  customerName,
  disabled,
  onResumed,
  returnFocus,
}: {
  sessionId: string
  customerName: string | null
  disabled: boolean
  onResumed: () => void
  returnFocus?: RefObject<HTMLInputElement | null>
}) {
  const cart = useCart()
  const [screen, setScreen] = useState<Screen | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)
  const working = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const blocked = disabled || cart.transferBusy || !!cart.pendingDraft
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await operation()
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo completar la operación. Reintenta.',
        )
    } finally {
      working.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const open = (next: Screen) => {
    setAnnouncement('')
    setCompleted(false)
    setError('')
    setNotice('')
    setLabel('')
    setScreen(next)
    cart.refreshHeld()
  }
  const hasCurrent = cart.cart.length > 0 || !!cart.pendingDraft
  const close = () => {
    if (!working.current && !cart.transferBusy) setScreen(null)
  }
  const title =
    screen?.kind === 'hold'
      ? 'Poner venta en espera'
      : screen?.kind === 'review'
        ? 'Revisar venta en espera'
        : screen?.kind === 'discard'
          ? 'Descartar venta en espera'
          : 'Ventas en espera'
  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            blocked ||
            !cart.cart.length ||
            !!cart.heldSalesError ||
            cart.heldSales.length >= HELD_SALES_LIMIT
          }
          onClick={() => open({ kind: 'hold' })}
        >
          <Pause aria-hidden className="size-3.5" /> Poner en espera
        </Button>
        <Button
          type="button"
          variant={cart.heldSales.length ? 'secondary' : 'ghost'}
          size="sm"
          disabled={blocked}
          onClick={() => open({ kind: 'list' })}
        >
          <Clock3 aria-hidden className="size-3.5" /> En espera ·{' '}
          {cart.heldSalesError ? '—' : cart.heldSales.length}
        </Button>
      </div>
      <Dialog
        open={screen !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent
          finalFocus={completed ? returnFocus : undefined}
          className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg"
          showCloseButton={!busy}
        >
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {screen?.kind === 'hold'
                ? 'Guarda esta compra para atender a otro cliente. El pago se captura al retomarla.'
                : 'Guardadas solo en este navegador y usuario. No registran cobros ni reservan inventario.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-1 py-1">
            {(error || cart.heldSalesError) && (
              <p role="alert" className="text-destructive text-sm">
                {error || cart.heldSalesError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm">
                {notice}
              </p>
            )}
            {busy && (
              <p role="status" className="text-muted-foreground text-sm">
                Comprobando y guardando…
              </p>
            )}
            {screen?.kind === 'hold' && (
              <form
                id="hold-sale-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(async () => {
                    await cart.holdSale(label, customerName)
                    if (!mounted.current) return
                    setCompleted(true)
                    setScreen(null)
                    setAnnouncement(
                      'Venta guardada en espera. Puedes atender al siguiente cliente.',
                    )
                  })
                }}
                className="space-y-4"
              >
                <div className="bg-muted/60 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
                  <div>
                    <p>
                      {cart.cart.length}{' '}
                      {cart.cart.length === 1 ? 'renglón' : 'renglones'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {customerName ?? 'Sin cliente'}
                    </p>
                  </div>
                  <strong className="text-xl tabular-nums">
                    {formatCurrency(saleTotal(cart.cart))}
                  </strong>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="held-sale-label">
                    Nombre o referencia (opcional)
                  </Label>
                  <Input
                    id="held-sale-label"
                    value={label}
                    maxLength={80}
                    disabled={busy}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Ej. Cliente de la bolsa azul"
                    autoFocus
                  />
                </div>
              </form>
            )}
            {screen?.kind === 'list' && (
              <>
                <p className="text-muted-foreground text-xs">
                  {cart.heldSales.length} de {HELD_SALES_LIMIT} espacios
                  utilizados. Se conservan al cerrar la caja.
                </p>
                {hasCurrent && (
                  <p className="bg-muted rounded-lg p-3 text-sm">
                    Pon la venta actual en espera o termínala antes de retomar
                    otra.
                  </p>
                )}
                {!cart.heldSales.length && !cart.heldSalesError && (
                  <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center">
                    <Clock3 aria-hidden className="size-8" />
                    <p>Aún no tienes ventas en espera.</p>
                  </div>
                )}
                <ul className="space-y-3">
                  {cart.heldSales.map((sale) => (
                    <li
                      key={sale.id}
                      className="space-y-3 rounded-xl border p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium wrap-break-word">
                            {sale.label ||
                              sale.customerName ||
                              'Venta sin nombre'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(sale.savedAt).toLocaleString('es-MX', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {sale.draft.lines.length}{' '}
                            {sale.draft.lines.length === 1
                              ? 'renglón'
                              : 'renglones'}
                          </p>
                          {sale.label && sale.customerName && (
                            <p className="text-muted-foreground text-xs">
                              Cliente: {sale.customerName}
                            </p>
                          )}
                        </div>
                        <strong className="tabular-nums">
                          {formatCurrency(sale.total)}
                        </strong>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-xs">
                        {sale.products
                          .map((product) => product.name)
                          .join(' · ')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || hasCurrent || blocked}
                          onClick={() =>
                            void run(async () => {
                              const review = await reviewHeldSale(
                                sale,
                                sessionId,
                              )
                              if (mounted.current)
                                setScreen({ kind: 'review', sale, review })
                            })
                          }
                        >
                          <Play aria-hidden className="size-3.5" /> Revisar y
                          retomar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => open({ kind: 'discard', sale })}
                        >
                          <Trash2 aria-hidden className="size-3.5" /> Descartar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {screen?.kind === 'review' && (
              <HeldSaleReview
                review={screen.review}
                previousTotal={screen.sale.total}
              />
            )}
            {screen?.kind === 'discard' && (
              <p>
                Se eliminará “
                {screen.sale.label ||
                  screen.sale.customerName ||
                  'Venta sin nombre'}
                ” por {formatCurrency(screen.sale.total)}. Esta compra todavía
                no fue cobrada.
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                screen?.kind === 'list' || screen?.kind === 'hold'
                  ? close()
                  : open({ kind: 'list' })
              }
            >
              {screen?.kind === 'list'
                ? 'Cerrar'
                : screen?.kind === 'hold'
                  ? 'Cancelar'
                  : 'Volver'}
            </Button>
            {screen?.kind === 'hold' && (
              <Button
                form="hold-sale-form"
                type="submit"
                disabled={busy || blocked || !cart.cart.length}
              >
                Guardar en espera
              </Button>
            )}
            {screen?.kind === 'discard' && (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await cart.discardHeld(screen.sale.id)
                    if (mounted.current) setScreen({ kind: 'list' })
                  })
                }
              >
                Descartar venta
              </Button>
            )}
            {screen?.kind === 'review' && (
              <Button
                disabled={
                  busy || hasCurrent || blocked || !screen.review.cart.length
                }
                onClick={() =>
                  void run(async () => {
                    const fresh = await reviewHeldSale(screen.sale, sessionId)
                    if (!mounted.current) return
                    if (
                      JSON.stringify(fresh) !== JSON.stringify(screen.review)
                    ) {
                      setScreen({ ...screen, review: fresh })
                      setNotice(
                        'Los datos cambiaron desde la revisión. Confirma el resumen actualizado.',
                      )
                      return
                    }
                    await cart.resumeSale(screen.sale.id, fresh, sessionId)
                    if (!mounted.current) return
                    setScreen(null)
                    setCompleted(true)
                    onResumed()
                    setAnnouncement(
                      'Venta retomada. Revisa el pago antes de cobrar.',
                    )
                  })
                }
              >
                Retomar venta
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
