import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/currency'
import { rankCandidates } from '@/lib/match'
import { normalizeSearch } from '@/lib/text'
import type { Product } from '@/features/catalog/useProducts'
import type { UnitOfMeasure } from '@/features/catalog/useUnits'
import type { Supplier } from './useSuppliers'
import { useTicketCapture, type TicketLectura, type TicketRenglon } from './useTicketCapture'

// Arriba de este puntaje, el producto se preselecciona solo; abajo, la
// línea se queda sin producto y obliga a elegirlo a mano. El objetivo no
// es acertar siempre, es no rellenar en silencio algo que está mal: un
// producto equivocado aquí mete costo y existencias falsas al inventario.
const UMBRAL_AUTOSELECCION = 0.6

type DraftLine = {
  key: string
  origen: TicketRenglon
  productId: string
  quantity: string
  unitCost: string
  include: boolean
}

function numero(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Los productos más parecidos primero, luego el resto en orden alfabético
 * -- así el probable ya viene arriba sin esconder el catálogo completo. */
function opcionesOrdenadas(descripcion: string | null, products: Product[]) {
  if (!descripcion) return products
  const ranked = rankCandidates(descripcion, products, (p) => p.name ?? '')
  const rankedIds = new Set(ranked.map((c) => c.item.id))
  return [...ranked.map((c) => c.item), ...products.filter((p) => !rankedIds.has(p.id))]
}

export function TicketCaptureDialog({
  suppliers,
  products,
  units,
  onCreate,
}: {
  suppliers: Supplier[]
  products: Product[]
  units: UnitOfMeasure[]
  onCreate: (values: {
    supplierId: string
    notes: string | null
    items: { productId: string; quantity: number; unitCost: number }[]
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [lectura, setLectura] = useState<TicketLectura | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { analyzing, analyze } = useTicketCapture()

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active), [suppliers])
  const unitById = useMemo(
    () => new Map(units.map((u) => [u.id, u])),
    [units],
  )

  const reset = () => {
    setLectura(null)
    setLines([])
    setSupplierId('')
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const resultado = await analyze(file)
    if (!resultado) return

    setLectura(resultado)

    // Proveedor: se propone el más parecido por nombre. El RFC no sirve
    // para esto -- en los tickets reales viene sellado o encimado y se
    // lee mal seguido (docs/captura-tickets-analisis.md).
    const nombreProveedor = resultado.extraccion.proveedor.nombre
    if (nombreProveedor) {
      const [mejor] = rankCandidates(nombreProveedor, activeSuppliers, (s) => s.name)
      if (mejor && mejor.score >= UMBRAL_AUTOSELECCION) setSupplierId(mejor.item.id)
    }

    setLines(
      resultado.verificacion.renglones.map((renglon) => {
        const [mejor] = renglon.descripcion
          ? rankCandidates(renglon.descripcion, activeProducts, (p) => p.name ?? '')
          : []
        return {
          key: `renglon-${renglon.indice}`,
          origen: renglon,
          productId:
            mejor && mejor.score >= UMBRAL_AUTOSELECCION ? (mejor.item.id ?? '') : '',
          quantity: renglon.cantidad !== null ? String(renglon.cantidad) : '',
          unitCost:
            renglon.precio_unitario !== null ? String(renglon.precio_unitario) : '',
          include: true,
        }
      }),
    )
  }

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const includedLines = lines.filter((l) => l.include)
  const total = includedLines.reduce(
    (sum, l) => sum + numero(l.quantity) * numero(l.unitCost),
    0,
  )
  const lineasIncompletas = includedLines.filter(
    (l) => !l.productId || numero(l.quantity) <= 0 || numero(l.unitCost) <= 0,
  ).length
  const puedeGuardar =
    !!supplierId && includedLines.length > 0 && lineasIncompletas === 0 && !submitting

  const handleSubmit = async () => {
    if (!puedeGuardar || !lectura) return
    setSubmitting(true)

    // La foto queda referenciada en las notas: si mañana un costo se ve
    // raro, se puede volver al ticket original en vez de adivinar.
    const doc = lectura.extraccion.documento
    const notas = [
      'Capturada por foto.',
      doc.folio ? `Folio ${doc.folio}.` : null,
      doc.fecha ? `Fecha del ticket: ${doc.fecha}.` : null,
      doc.total !== null ? `Total del ticket: ${formatCurrency(doc.total)}.` : null,
      `Foto: ${lectura.storagePath}`,
    ]
      .filter(Boolean)
      .join(' ')

    const ok = await onCreate({
      supplierId,
      notes: notas,
      items: includedLines.map((l) => ({
        productId: l.productId,
        quantity: numero(l.quantity),
        unitCost: numero(l.unitCost),
      })),
    })

    setSubmitting(false)
    if (ok) {
      toast.success('Orden creada. Recíbela para que entre a inventario y actualice costos.')
      handleOpenChange(false)
    }
  }

  const verificacion = lectura?.verificacion

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Camera className="size-4" /> Capturar por foto
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Capturar compra por foto</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!lectura && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Camera className="text-muted-foreground size-10" />
              <div>
                <p className="font-medium">Toma o sube la foto del ticket</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Se lee sola y después la revisas renglón por renglón antes de guardar.
                  Nada se guarda hasta que tú lo confirmes.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Leyendo el ticket…
                  </>
                ) : (
                  <>
                    <Camera className="size-4" /> Elegir foto
                  </>
                )}
              </Button>
            </div>
          )}

          {lectura && verificacion && (
            <div className="flex flex-col gap-5">
              {/* Cómo salió la lectura. Es lo primero que se ve a propósito:
                  dice de entrada cuánto hay que revisar, en vez de dejar que
                  la persona lo descubra bajando por la lista. */}
              <div
                className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                  verificacion.renglones_por_revisar > 0 || verificacion.cuadra === false
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-success/40 bg-success/5'
                }`}
              >
                {verificacion.renglones_por_revisar > 0 || verificacion.cuadra === false ? (
                  <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                ) : (
                  <Check className="text-success mt-0.5 size-4 shrink-0" />
                )}
                <div className="flex flex-col gap-1">
                  <p className="font-medium">
                    {verificacion.renglones.length} renglones leídos
                    {verificacion.renglones_por_revisar > 0
                      ? ` · ${verificacion.renglones_por_revisar} necesitan tu revisión`
                      : ' · todos cuadran'}
                  </p>
                  <p className="text-muted-foreground">
                    Suma de renglones {formatCurrency(verificacion.suma_renglones ?? 0)}
                    {verificacion.total_documento !== null && (
                      <>
                        {' · '}total del ticket{' '}
                        {formatCurrency(verificacion.total_documento)}
                      </>
                    )}
                    {verificacion.cuadra === false && verificacion.diferencia !== null && (
                      <>
                        {' · '}
                        <span className="text-destructive font-medium">
                          diferencia de {formatCurrency(verificacion.diferencia)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
                  <Label htmlFor="ticket-proveedor">Proveedor</Label>
                  <select
                    id="ticket-proveedor"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="border-input bg-transparent h-9 rounded-md border px-3 text-sm"
                  >
                    <option value="">Elige un proveedor…</option>
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {lectura.extraccion.proveedor.nombre && (
                  <p className="text-muted-foreground pb-2 text-xs">
                    El ticket dice:{' '}
                    <span className="text-foreground font-medium">
                      {lectura.extraccion.proveedor.nombre}
                    </span>
                    {!supplierId && ' — si no está en la lista, créalo primero en Proveedores.'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {lines.map((line) => {
                  const producto = activeProducts.find((p) => p.id === line.productId)
                  const unidadProducto = producto?.unit_id
                    ? unitById.get(producto.unit_id)
                    : undefined
                  // El ticket cobra por BULTO y el producto se mide en KG:
                  // capturar 1 x $412.50 dejaría el costo del kilo en $412.50.
                  // No se convierte solo (no se sabe cuántos kg trae el bulto),
                  // se avisa para que la persona capture en la unidad correcta.
                  const unidadDistinta =
                    !!line.origen.unidad &&
                    !!unidadProducto &&
                    normalizeSearch(line.origen.unidad) !==
                      normalizeSearch(unidadProducto.code) &&
                    normalizeSearch(line.origen.unidad) !==
                      normalizeSearch(unidadProducto.name)

                  return (
                    <div
                      key={line.key}
                      className={`rounded-md border p-3 ${
                        line.include ? '' : 'opacity-50'
                      } ${line.origen.requiere_revision ? 'border-destructive/40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {line.origen.descripcion ?? 'Renglón ilegible'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            El ticket dice:{' '}
                            {line.origen.cantidad !== null ? line.origen.cantidad : '—'}
                            {line.origen.unidad ? ` ${line.origen.unidad}` : ''} ×{' '}
                            {line.origen.precio_unitario !== null
                              ? formatCurrency(line.origen.precio_unitario)
                              : '—'}{' '}
                            ={' '}
                            {line.origen.importe !== null
                              ? formatCurrency(line.origen.importe)
                              : '—'}
                            {line.origen.cantidad_deducida && ' · cantidad deducida'}
                          </p>
                        </div>
                        <label className="flex shrink-0 items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={line.include}
                            onChange={(e) =>
                              updateLine(line.key, { include: e.target.checked })
                            }
                          />
                          Incluir
                        </label>
                      </div>

                      {line.include && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Producto</Label>
                            <select
                              value={line.productId}
                              onChange={(e) =>
                                updateLine(line.key, { productId: e.target.value })
                              }
                              className={`border-input bg-transparent h-9 rounded-md border px-2 text-sm ${
                                line.productId ? '' : 'border-destructive'
                              }`}
                            >
                              <option value="">Elige el producto…</option>
                              {opcionesOrdenadas(line.origen.descripcion, activeProducts).map(
                                (p) => (
                                  <option key={p.id} value={p.id ?? ''}>
                                    {p.name}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">
                              Cantidad{unidadProducto ? ` (${unidadProducto.code})` : ''}
                            </Label>
                            <Input
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.key, { quantity: e.target.value })
                              }
                              inputMode="decimal"
                              autoComplete="off"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Costo unitario</Label>
                            <Input
                              value={line.unitCost}
                              onChange={(e) =>
                                updateLine(line.key, { unitCost: e.target.value })
                              }
                              inputMode="decimal"
                              autoComplete="off"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Importe</Label>
                            <p className="flex h-9 items-center text-sm font-medium">
                              {formatCurrency(numero(line.quantity) * numero(line.unitCost))}
                            </p>
                          </div>
                        </div>
                      )}

                      {line.include && unidadDistinta && (
                        <p className="text-destructive mt-2 text-xs">
                          El ticket cobra por {line.origen.unidad} y este producto se mide en{' '}
                          {unidadProducto?.code}. Captura la cantidad y el costo en{' '}
                          {unidadProducto?.code}, no como viene en el ticket.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {lectura && (
          <DialogFooter className="flex-row items-center justify-between border-t px-6 py-4">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {includedLines.length} de {lines.length} renglones ·{' '}
              </span>
              <span className="text-brand-gold font-semibold">{formatCurrency(total)}</span>
              {lineasIncompletas > 0 && (
                <span className="text-destructive ml-2 text-xs">
                  {lineasIncompletas} sin completar
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!puedeGuardar}>
                {submitting ? 'Guardando…' : 'Crear orden de compra'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
