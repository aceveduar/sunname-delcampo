import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, FileImage, Loader2 } from 'lucide-react'
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
import { bestUnambiguous, rankCandidates } from '@/lib/match'
import { nombreDesdeTicket } from '@/lib/text'
import type { Product } from './useProducts'
import type { UnitOfMeasure } from './useUnits'
import {
  usePriceSheetCapture,
  type PriceSheetLectura,
  type PriceSheetRenglon,
} from './usePriceSheetCapture'

// Mismo umbral y misma razón que en la captura de compras por foto: un
// producto mal emparejado aquí le cambia el precio al producto
// equivocado, y eso se le cobra mal a los clientes hasta que alguien lo
// note. Preferimos dejarlo vacío.
const UMBRAL_AUTOSELECCION = 0.6

type DraftRow = {
  key: string
  origen: PriceSheetRenglon
  productId: string
  precioKilo: string
  precio100g: string
  include: boolean
}

function numero(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Los más parecidos primero (activos antes que inactivos a igual
 * parecido), luego el resto del catálogo. Se ofrece el catálogo completo:
 * los productos que esta hoja viene a poner en precio están justamente
 * inactivos por no tenerlo. */
function opcionesOrdenadas(descripcion: string | null, products: Product[]) {
  if (!descripcion) return products
  const activos = products.filter((p) => p.active)
  const inactivos = products.filter((p) => !p.active)
  const porParecido = [
    ...rankCandidates(descripcion, activos, (p) => p.name ?? '').map((c) => c.item),
    ...rankCandidates(descripcion, inactivos, (p) => p.name ?? '').map((c) => c.item),
  ]
  const yaListados = new Set(porParecido.map((p) => p.id))
  return [...porParecido, ...products.filter((p) => !yaListados.has(p.id))]
}

export function PriceSheetDialog({
  products,
  units,
  onApply,
  onCreateProduct,
}: {
  products: Product[]
  units: UnitOfMeasure[]
  onApply: (
    changes: {
      id: string
      price: number
      price_per_100g: number | null
      active?: boolean
    }[],
  ) => Promise<boolean>
  onCreateProduct: (values: {
    name: string
    unit_id: string
    active: boolean
  }) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [lectura, setLectura] = useState<PriceSheetLectura | null>(null)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [activar, setActivar] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [altaEnFila, setAltaEnFila] = useState<string | null>(null)
  const [nuevoProducto, setNuevoProducto] = useState({ name: '', unitId: '' })
  const [creandoProducto, setCreandoProducto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { analyzing, analyze } = usePriceSheetCapture()

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])
  const inactiveProducts = useMemo(() => products.filter((p) => !p.active), [products])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setLectura(null)
      setRows([])
      setAltaEnFila(null)
      setActivar(true)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const resultado = await analyze(file)
    if (!resultado) return
    setLectura(resultado)
    setRows(
      resultado.verificacion.renglones.map((renglon): DraftRow => {
        // Se prefiere un activo, pero se propone el inactivo si es el
        // único parecido razonable: casi todo el catálogo está inactivo
        // justamente por no tener precio todavía.
        const sugerido = renglon.descripcion
          ? (bestUnambiguous(
              rankCandidates(renglon.descripcion, activeProducts, (p) => p.name ?? ''),
              UMBRAL_AUTOSELECCION,
            ) ??
            bestUnambiguous(
              rankCandidates(renglon.descripcion, inactiveProducts, (p) => p.name ?? ''),
              UMBRAL_AUTOSELECCION,
            ))
          : null
        return {
          key: `renglon-${renglon.indice}`,
          origen: renglon,
          productId: sugerido?.id ?? '',
          precioKilo: renglon.precio_kilo !== null ? String(renglon.precio_kilo) : '',
          precio100g: renglon.precio_100g !== null ? String(renglon.precio_100g) : '',
          include: true,
        }
      }),
    )
  }

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const abrirAlta = (row: DraftRow) => {
    setAltaEnFila(row.key)
    setNuevoProducto({
      name: nombreDesdeTicket(row.origen.descripcion ?? ''),
      unitId: units.find((u) => u.code === 'KG')?.id ?? units[0]?.id ?? '',
    })
  }

  const handleCreateProduct = async (key: string) => {
    const nombre = nuevoProducto.name.trim()
    if (!nombre || !nuevoProducto.unitId) return
    setCreandoProducto(true)
    // Se crea inactivo: lo va a activar el propio guardado de esta hoja,
    // en cuanto quede con precio.
    const id = await onCreateProduct({
      name: nombre,
      unit_id: nuevoProducto.unitId,
      active: false,
    })
    setCreandoProducto(false)
    if (id) {
      updateRow(key, { productId: id })
      setAltaEnFila(null)
    }
  }

  const includedRows = rows.filter((r) => r.include)
  // Un producto no puede aparecer dos veces: el segundo pisaría al
  // primero en silencio y quedaría el precio equivocado.
  const duplicados = useMemo(() => {
    const vistos = new Map<string, number>()
    includedRows.forEach((r) => {
      if (r.productId) vistos.set(r.productId, (vistos.get(r.productId) ?? 0) + 1)
    })
    return new Set([...vistos.entries()].filter(([, n]) => n > 1).map(([id]) => id))
  }, [includedRows])

  const filasIncompletas = includedRows.filter(
    (r) => !r.productId || numero(r.precioKilo) <= 0 || numero(r.precio100g) <= 0,
  ).length
  const puedeGuardar =
    includedRows.length > 0 &&
    filasIncompletas === 0 &&
    duplicados.size === 0 &&
    !submitting

  const handleSubmit = async () => {
    if (!puedeGuardar) return
    setSubmitting(true)
    const ok = await onApply(
      includedRows.map((r) => ({
        id: r.productId,
        price: numero(r.precioKilo),
        price_per_100g: numero(r.precio100g),
        ...(activar ? { active: true } : {}),
      })),
    )
    setSubmitting(false)
    if (ok) handleOpenChange(false)
  }

  const verificacion = lectura?.verificacion

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <FileImage className="size-4" /> Precios por foto
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Cargar precios desde una hoja</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!lectura && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <FileImage className="text-muted-foreground size-10" />
              <div>
                <p className="font-medium">Toma o sube la foto de la hoja de precios</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Se lee sola y después la revisas renglón por renglón. Ningún precio
                  cambia hasta que tú lo confirmes.
                </p>
              </div>
              {/* Sin capture="environment" a propósito: ese atributo no
                  sugiere la cámara, la impone -- en Chrome de Android quita
                  la opción de galería. Y la foto casi siempre ya existe:
                  llega por WhatsApp, la tomó otra persona, o se tomó días
                  antes. Sin el atributo el celular ofrece cámara Y galería;
                  cuesta un toque extra cuando sí se quiere la cámara, y
                  desbloquea el caso más común. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Leyendo la hoja…
                  </>
                ) : (
                  <>
                    <FileImage className="size-4" /> Elegir foto
                  </>
                )}
              </Button>
            </div>
          )}

          {lectura && verificacion && (
            <div className="flex flex-col gap-5">
              <div
                className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                  verificacion.renglones_por_revisar > 0
                    ? 'border-destructive/40 bg-destructive/5'
                    : 'border-success/40 bg-success/5'
                }`}
              >
                {verificacion.renglones_por_revisar > 0 ? (
                  <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                ) : (
                  <Check className="text-success mt-0.5 size-4 shrink-0" />
                )}
                <div className="flex flex-col gap-1">
                  <p className="font-medium">
                    {verificacion.renglones.length} renglones leídos
                    {verificacion.renglones_por_revisar > 0
                      ? ` · ${verificacion.renglones_por_revisar} necesitan tu revisión`
                      : ' · todos completos'}
                    {lectura.extraccion.hoja.titulo && ` · ${lectura.extraccion.hoja.titulo}`}
                  </p>
                  {lectura.extraccion.notas && (
                    <p className="text-muted-foreground">{lectura.extraccion.notas}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {rows.map((row) => {
                  const duplicado = row.productId && duplicados.has(row.productId)
                  return (
                    <div
                      key={row.key}
                      className={`rounded-md border p-3 ${row.include ? '' : 'opacity-50'} ${
                        row.origen.requiere_revision || duplicado
                          ? 'border-destructive/40'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {row.origen.descripcion ?? 'Renglón ilegible'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            La hoja dice:{' '}
                            {row.origen.precio_100g !== null
                              ? `${formatCurrency(row.origen.precio_100g)}/100g`
                              : '—/100g'}
                            {' · '}
                            {row.origen.precio_kilo !== null
                              ? `${formatCurrency(row.origen.precio_kilo)}/kilo`
                              : '—/kilo'}
                            {row.origen.kilo_deducido && ' · kilo deducido del cuarto'}
                            {row.origen.cuarto_cuadra === false &&
                              ' · el cuarto NO coincide con kilo/4'}
                          </p>
                        </div>
                        <label className="flex shrink-0 items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                          />
                          Incluir
                        </label>
                      </div>

                      {row.include && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs">Producto</Label>
                              {!row.productId && altaEnFila !== row.key && (
                                <button
                                  type="button"
                                  onClick={() => abrirAlta(row)}
                                  className="text-primary text-xs underline underline-offset-2"
                                >
                                  No está en el catálogo
                                </button>
                              )}
                            </div>
                            <select
                              value={row.productId}
                              onChange={(e) => updateRow(row.key, { productId: e.target.value })}
                              className={`border-input bg-transparent h-9 rounded-md border px-2 text-sm ${
                                row.productId && !duplicado ? '' : 'border-destructive'
                              }`}
                            >
                              <option value="">Elige el producto…</option>
                              {opcionesOrdenadas(row.origen.descripcion, products).map((p) => (
                                <option key={p.id} value={p.id ?? ''}>
                                  {p.name}
                                  {p.active ? '' : ' (inactivo)'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Precio por kilo</Label>
                            <Input
                              value={row.precioKilo}
                              onChange={(e) => updateRow(row.key, { precioKilo: e.target.value })}
                              inputMode="decimal"
                              autoComplete="off"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Precio por 100 g</Label>
                            <Input
                              value={row.precio100g}
                              onChange={(e) => updateRow(row.key, { precio100g: e.target.value })}
                              inputMode="decimal"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                      )}

                      {row.include && duplicado && (
                        <p className="text-destructive mt-2 text-xs">
                          Este producto ya está en otro renglón de esta hoja. Deja uno solo:
                          si no, el último pisaría al primero sin avisar.
                        </p>
                      )}

                      {row.include && row.productId && numero(row.precioKilo) > 0 && (
                        <p className="text-muted-foreground mt-2 text-xs">
                          El cuarto se cobrará a{' '}
                          {formatCurrency(numero(row.precioKilo) / 4)} (kilo ÷ 4), y de 250 g
                          para abajo aplica la tarifa de 100 g.
                        </p>
                      )}

                      {row.include && altaEnFila === row.key && (
                        <div className="bg-muted/50 mt-3 flex flex-wrap items-end gap-3 rounded-md border p-3">
                          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                            <Label className="text-xs">Nombre en tu catálogo</Label>
                            <Input
                              value={nuevoProducto.name}
                              onChange={(e) =>
                                setNuevoProducto((p) => ({ ...p, name: e.target.value }))
                              }
                              autoComplete="off"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">Se mide en</Label>
                            <select
                              value={nuevoProducto.unitId}
                              onChange={(e) =>
                                setNuevoProducto((p) => ({ ...p, unitId: e.target.value }))
                              }
                              className="border-input bg-transparent h-9 rounded-md border px-2 text-sm"
                            >
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={creandoProducto || !nuevoProducto.name.trim()}
                              onClick={() => handleCreateProduct(row.key)}
                            >
                              {creandoProducto ? 'Creando…' : 'Crear producto'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAltaEnFila(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {lectura && (
          <DialogFooter className="mx-0 mb-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                {includedRows.length} de {rows.length} renglones
                {filasIncompletas > 0 && (
                  <span className="text-destructive"> · {filasIncompletas} sin completar</span>
                )}
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={activar}
                  onChange={(e) => setActivar(e.target.checked)}
                />
                Activar estos productos (ya con precio, se pueden vender)
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!puedeGuardar}>
                {submitting ? 'Guardando…' : `Aplicar ${includedRows.length} precios`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
