import { useMemo, useRef, useState } from 'react'
import { rankCandidates } from '@/lib/match'
import { nombreDesdeTicket } from '@/lib/text'
import type { Product } from '@/features/catalog/useProducts'
import type { UnitOfMeasure } from '@/features/catalog/useUnits'

/** Parte común de un renglón de borrador en los dos diálogos de captura
 * por foto (ticket de compra, hoja de precios): cada uno le agrega sus
 * propios campos (cantidad/costo/empaque vs. precio por kilo/100g). */
export type DraftRowBase<TOrigen> = {
  key: string
  origen: TOrigen
  productId: string
  include: boolean
}

export function numero(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Los más parecidos primero (activos antes que inactivos a igual
 * parecido), luego el resto del catálogo en orden alfabético.
 *
 * Se ofrece el catálogo COMPLETO, no solo lo activo: en captura de
 * compras un producto inactivo por falta de precio es justo el que se
 * compra para poder ponerlo a la venta; en carga de precios, casi todo
 * el catálogo está inactivo justamente por no tener precio todavía. */
export function opcionesOrdenadas(descripcion: string | null, products: Product[]) {
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

/** Ciclo compartido de los dos diálogos de captura por foto (ticket de
 * compra en Compras, hoja de precios en Catálogo): subir foto → leerla →
 * borrador editable renglón por renglón, con la salida de "no está en el
 * catálogo" para dar de alta un producto sin cancelar ni volver a pagar
 * una lectura. Lo que sí cambia entre los dos (cómo se arma cada renglón
 * a partir de la lectura, y qué hace el guardado final) se queda en cada
 * diálogo -- aquí solo vive lo que de verdad es idéntico. */
export function useProductDraftCapture<
  TLectura,
  TOrigen extends { descripcion: string | null },
  TRow extends DraftRowBase<TOrigen>,
>({
  analyze,
  products,
  units,
  buildRows,
  onCreateProduct,
  defaultUnitId,
  formatNewProductName,
}: {
  analyze: (file: File) => Promise<TLectura | null>
  products: Product[]
  units: UnitOfMeasure[]
  buildRows: (
    lectura: TLectura,
    context: { activeProducts: Product[]; inactiveProducts: Product[] },
  ) => TRow[]
  onCreateProduct: (values: {
    name: string
    unit_id: string
    active: boolean
  }) => Promise<string | null>
  /** Default: la primera unidad de la lista. */
  defaultUnitId?: (units: UnitOfMeasure[]) => string
  /** Default: el nombre tal cual lo escribió la persona. */
  formatNewProductName?: (name: string) => string
}) {
  const [lectura, setLectura] = useState<TLectura | null>(null)
  const [rows, setRows] = useState<TRow[]>([])
  const [altaEnFila, setAltaEnFila] = useState<string | null>(null)
  const [nuevoProducto, setNuevoProducto] = useState({ name: '', unitId: '' })
  const [creandoProducto, setCreandoProducto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products])
  const inactiveProducts = useMemo(() => products.filter((p) => !p.active), [products])

  const reset = () => {
    setLectura(null)
    setRows([])
    setAltaEnFila(null)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const resultado = await analyze(file)
    if (!resultado) return
    setLectura(resultado)
    setRows(buildRows(resultado, { activeProducts, inactiveProducts }))
  }

  const updateRow = (key: string, patch: Partial<TRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const abrirAlta = (row: TRow) => {
    setAltaEnFila(row.key)
    setNuevoProducto({
      // El ticket/hoja escribe con ruido de proveedor o de empaque; se
      // propone limpio pero editable, porque el nombre bueno es el que
      // usa el negocio, no el que trae la foto.
      name: nombreDesdeTicket(row.origen.descripcion ?? ''),
      unitId: defaultUnitId ? defaultUnitId(units) : (units[0]?.id ?? ''),
    })
  }

  const handleCreateProduct = async (key: string) => {
    const nombre = nuevoProducto.name.trim()
    if (!nombre || !nuevoProducto.unitId) return
    setCreandoProducto(true)
    const id = await onCreateProduct({
      name: formatNewProductName ? formatNewProductName(nombre) : nombre,
      unit_id: nuevoProducto.unitId,
      active: false,
    })
    setCreandoProducto(false)
    if (id) {
      updateRow(key, { productId: id } as Partial<TRow>)
      setAltaEnFila(null)
    }
  }

  const includedRows = useMemo(() => rows.filter((r) => r.include), [rows])

  return {
    lectura,
    setLectura,
    rows,
    setRows,
    includedRows,
    activeProducts,
    inactiveProducts,
    altaEnFila,
    setAltaEnFila,
    nuevoProducto,
    setNuevoProducto,
    creandoProducto,
    fileInputRef,
    reset,
    handleFile,
    updateRow,
    abrirAlta,
    handleCreateProduct,
  }
}
