import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { ProductName } from '@/components/ProductName'
import type { StockRow } from './useInventoryStock'
import { searchStockRows } from './inventorySearch'
import { formatStock } from './stockQuantity'

export function InventoryProductPicker({
  rows,
  selectedId,
  unitCode,
  onSelect,
}: {
  rows: StockRow[]
  selectedId: string
  unitCode: (id: string) => string
  onSelect: (id: string) => void
}) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [choosing, setChoosing] = useState(!selectedId)
  const selected = rows.find((row) => row.product.id === selectedId)
  const matches = searchStockRows(rows, search)
  if (selected && !choosing)
    return (
      <div className="bg-muted/40 flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0">
          <p className="font-medium wrap-break-word">
            <ProductName name={selected.product.name} />
          </p>
          <p className="text-muted-foreground text-xs">
            {selected.product.sku || 'Sin código'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setChoosing(true)}
        >
          Cambiar
        </Button>
      </div>
    )
  return (
    <div className="space-y-2">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Buscar producto por nombre o código"
        aria-controls={id}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      />
      <ul
        id={id}
        aria-label="Productos para el movimiento"
        className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1"
      >
        {matches.slice(0, 10).map((row) => (
          <li key={row.product.id}>
            <button
              type="button"
              className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-md p-2 text-left"
              onClick={() => {
                onSelect(row.product.id)
                setChoosing(false)
                setSearch('')
              }}
            >
              <span className="min-w-0">
                <span className="block font-medium wrap-break-word">
                  <ProductName name={row.product.name} />
                </span>
                <span className="text-muted-foreground text-xs">
                  {row.product.sku || 'Sin código'}
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatStock(row.quantityOnHand)}{' '}
                {unitCode(row.product.unit_id)}
              </span>
            </button>
          </li>
        ))}
        {!matches.length && (
          <li className="text-muted-foreground p-3">No hay coincidencias.</li>
        )}
      </ul>
      {matches.length > 10 && (
        <p className="text-muted-foreground text-xs">
          Mostrando 10 de {matches.length}. Escribe para precisar la búsqueda.
        </p>
      )}
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setChoosing(false)}
        >
          Conservar producto
        </Button>
      )}
    </div>
  )
}
