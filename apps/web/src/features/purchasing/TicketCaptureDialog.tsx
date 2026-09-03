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
import { bestUnambiguous, rankCandidates, type Candidate } from '@/lib/match'
import { empaqueDesdeTicket, nombreDesdeTicket, normalizeSearch, toTitleCase } from '@/lib/text'
import type { Product } from '@/features/catalog/useProducts'
import type { UnitOfMeasure } from '@/features/catalog/useUnits'
import type { Supplier } from './useSuppliers'
import { useTicketCapture, type TicketLectura, type TicketRenglon } from './useTicketCapture'
import { useSupplierAliases } from './useSupplierAliases'

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
  /** Cuántas unidades del producto se contaron por cada unidad del
   * ticket. 1 = se capturó tal cual viene. 25 = un bulto de 25 kg. */
  packFactor: number
  /** Conversión que el ticket sugiere pero que nadie ha confirmado. Se
   * ofrece con un botón; no se aplica sola. */
  packHint: number | null
}

const redondear = (valor: number, decimales: number) => {
  const f = 10 ** decimales
  return Math.round(valor * f) / f
}

function numero(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Los más parecidos primero (activos antes que inactivos a igual
 * parecido), luego el resto del catálogo en orden alfabético.
 *
 * Se ofrece el catálogo COMPLETO, no solo lo activo: "activo" dice si un
 * producto se puede vender hoy, no si se puede comprar. Un producto
 * desactivado por no tener precio todavía es justo el que se compra para
 * poder ponerlo a la venta. Filtrar por activo aquí escondía la mayor
 * parte del catálogo real y forzaba a elegir entre productos que no
 * tenían nada que ver con el ticket. */
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

const mejorInequivoco = <T,>(candidatos: Candidate<T>[]) =>
  bestUnambiguous(candidatos, UMBRAL_AUTOSELECCION)

export function TicketCaptureDialog({
  suppliers,
  products,
  units,
  onCreate,
  onCreateSupplier,
  onCreateProduct,
}: {
  suppliers: Supplier[]
  products: Product[]
  units: UnitOfMeasure[]
  onCreate: (values: {
    supplierId: string
    notes: string | null
    items: { productId: string; quantity: number; unitCost: number }[]
  }) => Promise<boolean>
  onCreateSupplier: (values: { name: string }) => Promise<string | null>
  onCreateProduct: (values: {
    name: string
    unit_id: string
    active: boolean
  }) => Promise<string | null>
}) {
  const [open, setOpen] = useState(false)
  const [lectura, setLectura] = useState<TicketLectura | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [creandoProveedor, setCreandoProveedor] = useState(false)
  const [altaEnLinea, setAltaEnLinea] = useState<string | null>(null)
  const [nuevoProducto, setNuevoProducto] = useState({ name: '', unitId: '' })
  const [creandoProducto, setCreandoProducto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { analyzing, analyze } = useTicketCapture()
  const { findAlias, rememberAliases } = useSupplierAliases()

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])
  const inactiveProducts = useMemo(() => products.filter((p) => !p.active), [products])
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
    const proveedor = nombreProveedor
      ? mejorInequivoco(rankCandidates(nombreProveedor, activeSuppliers, (s) => s.name))
      : null
    if (proveedor) setSupplierId(proveedor.id)

    // Se usa el id resuelto aquí y no el del estado: setSupplierId no
    // surte efecto hasta el siguiente render, y las equivalencias
    // aprendidas se buscan por proveedor.
    setLines(construirLineas(resultado, proveedor?.id ?? ''))
  }

  /** Arma el borrador. Primero pregunta si ya se aprendió qué es este
   * renglón para este proveedor; solo si no, cae al parecido de nombres. */
  const construirLineas = (resultado: TicketLectura, supplierIdResuelto: string) =>
    resultado.verificacion.renglones.map((renglon): DraftLine => {
      const alias = findAlias(
        supplierIdResuelto,
        renglon.descripcion,
        renglon.codigo_proveedor,
      )
      const productoAprendido = alias
        ? (products.find((p) => p.id === alias.product_id) ?? null)
        : null

      // La conversión de empaque solo se aplica sola cuando ya la
      // confirmó una persona antes (viene de una equivalencia guardada).
      // Lo que se deduce leyendo el ticket se ofrece, no se aplica: el
      // negocio compra por bulto y vende por kilo, pero de "20 LT" no se
      // puede saber si el producto se mide en litros o en garrafas.
      const factor = alias ? Number(alias.units_per_package) : 1
      const sugerenciaEmpaque =
        !alias && renglon.descripcion ? empaqueDesdeTicket(renglon.descripcion) : null

      const sugerido =
        productoAprendido ??
        (renglon.descripcion
          ? (mejorInequivoco(
              rankCandidates(renglon.descripcion, activeProducts, (p) => p.name ?? ''),
            ) ??
            mejorInequivoco(
              rankCandidates(renglon.descripcion, inactiveProducts, (p) => p.name ?? ''),
            ))
          : null)

      return {
        key: `renglon-${renglon.indice}`,
        origen: renglon,
        productId: sugerido?.id ?? '',
        quantity:
          renglon.cantidad !== null ? String(redondear(renglon.cantidad * factor, 3)) : '',
        unitCost:
          renglon.precio_unitario !== null
            ? String(redondear(renglon.precio_unitario / factor, 2))
            : '',
        include: true,
        packFactor: factor,
        packHint: sugerenciaEmpaque,
      }
    })

  const handleCreateSupplier = async () => {
    const nombre = lectura?.extraccion.proveedor.nombre
    if (!nombre) return
    setCreandoProveedor(true)
    // El RFC leído del ticket no se guarda: en los tickets reales viene
    // sellado o encimado y se lee mal seguido, y un RFC equivocado en el
    // padrón de proveedores es peor que no tener ninguno.
    const id = await onCreateSupplier({ name: nombre })
    setCreandoProveedor(false)
    if (id) setSupplierId(id)
  }

  // Alta de un producto que el ticket trae pero el catálogo todavía no.
  // Se crea INACTIVO y sin precio, que es justo la convención que ya usa
  // el negocio: el producto existe y se puede comprar, pero no se vende
  // hasta que alguien le ponga precio. El costo se lo pone la recepción
  // de esta misma orden.
  const handleCreateProduct = async (key: string) => {
    const nombre = nuevoProducto.name.trim()
    if (!nombre || !nuevoProducto.unitId) return
    setCreandoProducto(true)
    const id = await onCreateProduct({
      name: toTitleCase(nombre),
      unit_id: nuevoProducto.unitId,
      active: false,
    })
    setCreandoProducto(false)
    if (id) {
      updateLine(key, { productId: id })
      setAltaEnLinea(null)
    }
  }

  const abrirAlta = (line: DraftLine) => {
    setAltaEnLinea(line.key)
    setNuevoProducto({
      // El ticket escribe con las palabras del proveedor ("ARROZ SAMAN
      // C/25 KG"); se propone en formato de catálogo pero editable, porque
      // el nombre bueno es el que usa el negocio, no el del proveedor.
      name: nombreDesdeTicket(line.origen.descripcion ?? ''),
      unitId: units[0]?.id ?? '',
    })
  }

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  /** Aplica la conversión que sugiere el ticket: si el bulto trae 25 kg,
   * 1 bulto a $412.50 pasa a 25 kg a $16.50. Se recalcula desde los
   * valores originales del ticket, no desde lo que hay en pantalla, para
   * que aplicarla dos veces no multiplique dos veces. */
  const aplicarEmpaque = (line: DraftLine) => {
    const factor = line.packHint
    if (!factor) return
    updateLine(line.key, {
      quantity:
        line.origen.cantidad !== null
          ? String(redondear(line.origen.cantidad * factor, 3))
          : line.quantity,
      unitCost:
        line.origen.precio_unitario !== null
          ? String(redondear(line.origen.precio_unitario / factor, 2))
          : line.unitCost,
      packFactor: factor,
      packHint: null,
    })
  }

  /** Al cambiar de proveedor se vuelven a consultar las equivalencias
   * aprendidas, pero solo se rellenan los renglones que siguen vacíos:
   * nunca se pisa algo que una persona ya eligió. */
  const handleSupplierChange = (nuevoId: string) => {
    setSupplierId(nuevoId)
    if (!nuevoId) return
    setLines((prev) =>
      prev.map((line) => {
        if (line.productId) return line
        const alias = findAlias(nuevoId, line.origen.descripcion, line.origen.codigo_proveedor)
        if (!alias) return line
        const factor = Number(alias.units_per_package)
        return {
          ...line,
          productId: alias.product_id,
          quantity:
            line.origen.cantidad !== null
              ? String(redondear(line.origen.cantidad * factor, 3))
              : line.quantity,
          unitCost:
            line.origen.precio_unitario !== null
              ? String(redondear(line.origen.precio_unitario / factor, 2))
              : line.unitCost,
          packFactor: factor,
          packHint: null,
        }
      }),
    )
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

    if (ok) {
      // Se aprende de lo que la persona acabó eligiendo, incluida la
      // conversión de empaque: si el ticket decía 1 bulto y se capturaron
      // 25 kg, el próximo ticket de este proveedor ya llega convertido.
      await rememberAliases(
        includedLines
          .filter((l) => l.productId && l.origen.descripcion)
          .map((l) => ({
            supplierId,
            ticketText: l.origen.descripcion as string,
            supplierCode: l.origen.codigo_proveedor,
            productId: l.productId,
            unitsPerPackage:
              l.origen.cantidad && l.origen.cantidad > 0
                ? redondear(numero(l.quantity) / l.origen.cantidad, 3)
                : 1,
          }))
          .filter((e) => e.unitsPerPackage > 0),
      )
    }

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
                    onChange={(e) => handleSupplierChange(e.target.value)}
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
                  <div className="flex min-w-0 flex-wrap items-center gap-2 pb-1.5">
                    <p className="text-muted-foreground text-xs">
                      El ticket dice:{' '}
                      <span className="text-foreground font-medium">
                        {lectura.extraccion.proveedor.nombre}
                      </span>
                    </p>
                    {/* Sin esto, un proveedor que todavía no existe obliga a
                        cancelar, darlo de alta en la otra pestaña y volver a
                        subir la foto -- o sea a pagar otra lectura y capturar
                        todo de nuevo. En el primer ticket real no hay ningún
                        proveedor dado de alta, así que es el caso normal, no
                        la excepción. */}
                    {!supplierId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={creandoProveedor}
                        onClick={handleCreateSupplier}
                      >
                        {creandoProveedor ? 'Creando…' : 'Darlo de alta'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {lines.map((line) => {
                  const producto = products.find((p) => p.id === line.productId)
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
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs">Producto</Label>
                              {!line.productId && altaEnLinea !== line.key && (
                                <button
                                  type="button"
                                  onClick={() => abrirAlta(line)}
                                  className="text-primary text-xs underline underline-offset-2"
                                >
                                  No está en el catálogo
                                </button>
                              )}
                            </div>
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
                              {opcionesOrdenadas(line.origen.descripcion, products).map((p) => (
                                <option key={p.id} value={p.id ?? ''}>
                                  {p.name}
                                  {p.active ? '' : ' (inactivo)'}
                                </option>
                              ))}
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

                      {line.include && line.packHint && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            El ticket dice que cada {line.origen.unidad ?? 'empaque'} trae{' '}
                            {line.packHint}
                            {unidadProducto ? ` ${unidadProducto.code}` : ''}.
                          </span>
                          <button
                            type="button"
                            onClick={() => aplicarEmpaque(line)}
                            className="text-primary underline underline-offset-2"
                          >
                            Convertir
                          </button>
                        </div>
                      )}

                      {line.include && line.packFactor !== 1 && (
                        <p className="text-muted-foreground mt-2 text-xs">
                          Convertido: {line.origen.cantidad}{' '}
                          {line.origen.unidad ?? 'empaque'} × {line.packFactor} ={' '}
                          {line.quantity}
                          {unidadProducto ? ` ${unidadProducto.code}` : ''}.
                        </p>
                      )}

                      {line.include && altaEnLinea === line.key && (
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
                              onClick={() => handleCreateProduct(line.key)}
                            >
                              {creandoProducto ? 'Creando…' : 'Crear producto'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setAltaEnLinea(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                          <p className="text-muted-foreground w-full text-xs">
                            Se crea sin precio y desactivado, para que no se pueda vender
                            por error. Ponle precio en Catálogo cuando lo tengas; el costo
                            se lo pone esta misma compra al recibirla.
                          </p>
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

        {/* mx-0/mb-0 cancelan los -mx-4 -mb-4 que DialogFooter trae para
            sangrar hasta el borde de un diálogo con padding propio: aquí el
            contenido va con p-0, así que ese margen negativo sacaba el pie
            20px fuera del diálogo (medido con texto grande, donde 1rem =
            20px). */}
        {lectura && (
          <DialogFooter className="mx-0 mb-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
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
            {/* flex-wrap: en pantalla chica con texto grande, "Cancelar" y
                "Crear orden de compra" lado a lado no caben (medido: 13px
                de más a 390px) y los botones no encogen. */}
            <div className="flex flex-wrap justify-end gap-2">
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
