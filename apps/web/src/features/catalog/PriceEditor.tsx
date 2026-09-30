import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/usePagination'
import { normalizeSearch } from '@/lib/text'
import { formatCurrency } from '@/lib/currency'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Product, useProducts } from './useProducts'
import {
  collectPriceEdits,
  priceError,
  type PriceDrafts,
  type PriceField,
} from './priceEdits'

export function PriceEditor({
  products,
  onSave,
  onClose,
  unitCode,
}: {
  products: Product[]
  onSave: ReturnType<typeof useProducts>['updatePrices']
  onClose: () => void
  unitCode: (id: string) => string
}) {
  const [drafts, setDrafts] = useState<PriceDrafts>({})
  const [search, setSearch] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [review, setReview] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const lock = useRef(false)
  const online = useOnlineStatus()
  const { changes, errors } = collectPriceEdits(products, drafts)
  const pendingIds = new Set([...changes, ...errors].map((row) => row.id))
  const query = normalizeSearch(search)
  const filtered = products.filter(
    (product) =>
      (!onlyPending || pendingIds.has(product.id)) &&
      (!query ||
        normalizeSearch(product.name + ' ' + (product.sku ?? '')).includes(
          query,
        )),
  )
  const pagination = usePagination(filtered)
  const update = (id: string, field: PriceField, value: string) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }))
  async function save() {
    if (lock.current || !online || errors.length || !changes.length) return
    lock.current = true
    setSaving(true)
    setSaveError('')
    try {
      if (await onSave(changes)) onClose()
      else {
        setReview(false)
        setSaveError(
          'No se confirmaron todos los cambios. Revisa los precios pendientes antes de reintentar.',
        )
      }
    } catch {
      setReview(false)
      setSaveError(
        'No se pudo confirmar el guardado. Conservamos los precios capturados para que puedas revisarlos.',
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Editar precios</h2>
        <p className="text-muted-foreground text-sm">
          Captura los nuevos importes y revisa todos los cambios antes de
          guardarlos.
        </p>
      </div>
      <form onSubmit={(event) => event.preventDefault()}>
        <fieldset disabled={saving} className="space-y-4">
          <div className="bg-background/95 sticky top-2 z-10 space-y-3 rounded-xl border p-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => (pendingIds.size ? setDiscard(true) : onClose())}
              >
                Volver al catálogo
              </Button>
              <Button
                disabled={!online || !changes.length || !!errors.length}
                onClick={() => {
                  setSaveError('')
                  setReview(true)
                }}
              >
                Revisar {changes.length}{' '}
                {changes.length === 1 ? 'cambio' : 'cambios'}
              </Button>
              <span className="text-muted-foreground text-sm" role="status">
                {changes.length} {changes.length === 1 ? 'cambio' : 'cambios'} ·{' '}
                {errors.length} por corregir, en todas las páginas
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={(value) => {
                  setSearch(value)
                  pagination.setPage(1)
                }}
                placeholder="Buscar nombre o código…"
                containerClassName="min-w-0 flex-1"
              />
              <Button
                variant={onlyPending ? 'default' : 'outline'}
                aria-pressed={onlyPending}
                onClick={() => {
                  setOnlyPending(!onlyPending)
                  pagination.setPage(1)
                }}
              >
                Solo pendientes
              </Button>
            </div>
            {!online && (
              <p role="status" className="text-sm">
                Necesitas conexión para guardar.
              </p>
            )}
          </div>
          {saveError && (
            <p role="alert" className="text-destructive text-sm">
              {saveError}
            </p>
          )}
          {errors.length > 0 && (
            <p role="alert" className="text-destructive text-sm">
              Corrige los importes de:{' '}
              {errors.map((error) => error.name).join(', ')}. No se guardará
              ningún cambio mientras haya errores.
            </p>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {pagination.pageItems.map((product) => (
              <article
                key={product.id}
                className="space-y-3 rounded-xl border p-4"
              >
                <div>
                  <h3 className="font-medium wrap-break-word">
                    {product.name}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {product.sku ?? 'Sin código'} ·{' '}
                    {product.active ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      'price',
                      ...(product.sold_by_weight ? ['price_per_100g'] : []),
                    ] as PriceField[]
                  ).map((field) => {
                    const current =
                      field === 'price'
                        ? product.price
                        : (product.price_per_100g ?? 0)
                    const value = drafts[product.id]?.[field] ?? String(current)
                    const error = priceError(value)
                    const id = `price-${product.id}-${field}`
                    const unit =
                      field === 'price_per_100g'
                        ? '100 g'
                        : product.sold_by_weight
                          ? 'kg'
                          : unitCode(product.unit_id)
                    return (
                      <div key={field} className="space-y-1.5">
                        <Label htmlFor={id}>
                          Nuevo precio {unit && `(${unit})`}
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          Actual: {formatCurrency(current)}
                        </p>
                        <Input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max="9999999999.99"
                          value={value}
                          aria-invalid={!!error}
                          aria-describedby={error ? `${id}-error` : undefined}
                          onChange={(event) =>
                            update(product.id, field, event.target.value)
                          }
                        />
                        {error && (
                          <p
                            id={`${id}-error`}
                            className="text-destructive text-xs"
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No hay productos que coincidan con estos filtros.
            </p>
          )}
          <PaginationControls
            {...pagination}
            onPageChange={pagination.setPage}
          />
        </fieldset>
      </form>
      <Dialog
        open={review}
        onOpenChange={(open) => {
          if (!lock.current) setReview(open)
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
          showCloseButton={!saving}
        >
          <DialogHeader>
            <DialogTitle>Revisar precios</DialogTitle>
            <DialogDescription>
              {changes.length} productos de todas las páginas y filtros.
              Confirma los importes antes de guardar.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {changes.map((change) => {
              const product = products.find(
                (product) => product.id === change.id,
              )!
              return (
                <li
                  key={change.id}
                  className="space-y-1 rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium wrap-break-word">{product.name}</p>
                  <p>
                    {product.sold_by_weight
                      ? 'Por kg'
                      : unitCode(product.unit_id)}
                    : {formatCurrency(product.price)} →{' '}
                    <strong>{formatCurrency(change.price)}</strong>
                  </p>
                  {product.sold_by_weight && (
                    <p>
                      Por 100 g: {formatCurrency(product.price_per_100g ?? 0)} →{' '}
                      <strong>
                        {formatCurrency(change.price_per_100g ?? 0)}
                      </strong>
                    </p>
                  )}
                  {(change.price === 0 ||
                    (product.sold_by_weight &&
                      change.price_per_100g === 0)) && (
                    <p className="text-destructive">
                      Revisa el importe en cero antes de confirmar.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {!!errors.length && (
            <p role="alert">Hay importes por corregir. Vuelve a la captura.</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setReview(false)}
            >
              Seguir editando
            </Button>
            <Button
              disabled={saving || !online || !!errors.length || !changes.length}
              onClick={save}
            >
              {saving ? 'Guardando…' : 'Confirmar precios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title="¿Descartar precios pendientes?"
        description="Los importes capturados sin guardar se perderán. Cancela para seguir editando."
        confirmLabel="Descartar cambios"
        variant="destructive"
        onConfirm={onClose}
      />
    </section>
  )
}
