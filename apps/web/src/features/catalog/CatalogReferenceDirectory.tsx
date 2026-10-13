import { useMemo, useState } from 'react'
import { ListFilter, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import { PaginationControls } from '@/components/PaginationControls'
import { TableSkeletonRows } from '@/components/TableSkeletonRows'
import { normalizeSearch } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'

type Reference = { id: string; name: string; active: boolean }

/** Presentación común de categorías y unidades; las escrituras quedan en cada pestaña. */
export function CatalogReferenceDirectory<T extends Reference>({
  items,
  singular,
  plural,
  detailLabel,
  detailValue,
  searchPlaceholder,
  loading,
  error,
  canManage,
  pendingId,
  onEdit,
  onToggle,
}: {
  items: T[]
  singular: string
  plural: string
  detailLabel: string
  detailValue: (item: T) => string
  searchPlaceholder: string
  loading: boolean
  error: string | null
  canManage: boolean
  pendingId: string | null
  onEdit: (item: T) => void
  onToggle: (item: T) => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = useMemo(() => {
    const tokens = normalizeSearch(search).split(/\s+/).filter(Boolean)
    return items.filter(
      (item) =>
        (status === 'all' || item.active === (status === 'active')) &&
        tokens.every((token) =>
          normalizeSearch(`${item.name} ${detailValue(item)}`).includes(token),
        ),
    )
  }, [items, search, status, detailValue])
  const pagination = usePagination(filtered)
  const resetPage = () => {
    if (pagination.page > 1) pagination.setPage(1)
  }
  const busy = loading || !!error
  const disabled = busy || pendingId !== null
  const hasFilters = !!search.trim() || status !== 'all'
  const activeCount = items.filter((item) => item.active).length
  const state = (item: T) => (
    <Badge
      variant="outline"
      className={
        item.active
          ? 'border-success/20 bg-success/10 text-success'
          : 'text-muted-foreground'
      }
    >
      {item.active ? 'Activa' : 'Inactiva'}
    </Badge>
  )
  const actions = (item: T) => {
    const stateLabel =
      pendingId === item.id
        ? 'Guardando…'
        : item.active
          ? 'Desactivar'
          : 'Activar'
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Editar ${item.name}`}
          onClick={() => onEdit(item)}
        >
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`${stateLabel} ${item.name}`}
          onClick={() => onToggle(item)}
        >
          {stateLabel}
        </Button>
      </>
    )
  }
  return (
    <section
      className="space-y-4"
      aria-label={`Directorio de ${plural}`}
      aria-busy={loading}
    >
      <div className="bg-card space-y-3 rounded-xl border p-3 shadow-sm">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            resetPage()
          }}
          aria-label={`Buscar ${plural}`}
          placeholder={searchPlaceholder}
        />
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={`Estado de ${plural}`}
        >
          {[
            { id: 'all', label: 'Todas', count: items.length },
            { id: 'active', label: 'Activas', count: activeCount },
            {
              id: 'inactive',
              label: 'Inactivas',
              count: items.length - activeCount,
            },
          ].map((filter) => (
            <Button
              key={filter.id}
              size="sm"
              variant={status === filter.id ? 'default' : 'ghost'}
              aria-pressed={status === filter.id}
              onClick={() => {
                setStatus(filter.id)
                resetPage()
              }}
            >
              {filter.label}
              <span className="ml-1 text-xs opacity-75">
                {busy ? '—' : filter.count}
              </span>
            </Button>
          ))}
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('')
                setStatus('all')
                resetPage()
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>
      {error && items.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Mostrando la última consulta correcta. Actualiza para editar.
        </p>
      )}
      {!busy && (
        <p role="status" className="text-muted-foreground text-sm">
          {filtered.length} {filtered.length === 1 ? singular : plural}
          {hasFilters ? ' con estos filtros' : ' en el catálogo'}
        </p>
      )}
      {!busy && !filtered.length ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={hasFilters ? Search : ListFilter}
            title={
              hasFilters
                ? 'No encontramos coincidencias'
                : `Aún no hay ${plural}`
            }
            description={
              hasFilters
                ? 'Prueba otro nombre o cambia el estado.'
                : canManage
                  ? `Usa “Nueva ${singular}” para empezar a organizar el catálogo.`
                  : 'El administrador puede agregar registros al catálogo.'
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block" aria-label={`Tabla de ${plural}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>{detailLabel}</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && (
                    <TableHead className="text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !items.length && (
                  <TableSkeletonRows rows={4} columns={canManage ? 4 : 3} />
                )}
                {pagination.pageItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-sm font-medium wrap-anywhere whitespace-normal">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-sm wrap-anywhere whitespace-normal">
                      {detailValue(item)}
                    </TableCell>
                    <TableCell>{state(item)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {actions(item)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div
            className="grid gap-3 md:grid-cols-2 lg:hidden"
            aria-label={`Tarjetas de ${plural}`}
          >
            {loading && !items.length && (
              <p role="status" className="text-muted-foreground">
                Cargando {plural}…
              </p>
            )}
            {pagination.pageItems.map((item) => (
              <article
                key={item.id}
                aria-label={item.name}
                className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 font-semibold wrap-anywhere">
                    {item.name}
                  </h3>
                  {state(item)}
                </div>
                <dl className="min-w-0 flex-1 text-sm">
                  <dt className="text-muted-foreground mb-1 text-xs">
                    {detailLabel}
                  </dt>
                  <dd className="wrap-anywhere">{detailValue(item)}</dd>
                </dl>
                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {actions(item)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {!busy && (
        <PaginationControls {...pagination} onPageChange={pagination.setPage} />
      )}
    </section>
  )
}
