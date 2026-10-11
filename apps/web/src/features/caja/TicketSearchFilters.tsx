import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ticketDates,
  ticketDatePresets,
  ticketStatuses,
  initialTicketValues,
  type TicketSearchValues,
} from './ticketFilters'

export function TicketSearchFilters({
  values,
  onChange,
  onSearch,
  loading,
  error,
  dirty,
}: {
  values: TicketSearchValues
  onChange: (values: TicketSearchValues) => void
  onSearch: (values: TicketSearchValues) => boolean
  loading: boolean
  error: string | null
  dirty: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (error && formRef.current)
      formRef.current.scrollTop = formRef.current.scrollHeight
  }, [error])
  const submit = (next: TicketSearchValues) => {
    if (onSearch(next)) setExpanded(false)
  }
  const apply = (next: TicketSearchValues) => {
    onChange(next)
    submit(next)
  }
  return (
    <form
      ref={formRef}
      className="max-h-[36dvh] min-h-0 overflow-y-auto overscroll-contain border-b p-4 md:max-h-none md:border-r md:border-b-0"
      onSubmit={(event) => {
        event.preventDefault()
        submit(values)
      }}
    >
      <fieldset disabled={loading} className="min-w-0 space-y-3">
        <legend className="sr-only">Filtros de tickets</legend>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">
            Fecha de venta
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ticketDatePresets.map((preset) => {
              const dates = ticketDates(preset.value)
              const selected =
                values.start === dates.start && values.end === dates.end
              return (
                <Button
                  key={preset.value}
                  type="button"
                  size="sm"
                  variant={selected ? 'default' : 'outline'}
                  aria-pressed={selected}
                  onClick={() =>
                    apply({ ...values, ...ticketDates(preset.value) })
                  }
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start md:hidden"
          aria-expanded={expanded}
          aria-controls="ticket-advanced-filters"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal />
          Filtros de búsqueda
          <ChevronDown
            className={expanded ? 'ml-auto rotate-180' : 'ml-auto'}
          />
        </Button>
        <div
          id="ticket-advanced-filters"
          className={expanded ? 'space-y-3' : 'hidden space-y-3 md:block'}
        >
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">
              Estado de la venta
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ticketStatuses.map((status) => (
                <Button
                  key={status.value}
                  type="button"
                  size="sm"
                  variant={
                    values.status === status.value ? 'default' : 'outline'
                  }
                  aria-pressed={values.status === status.value}
                  onClick={() => apply({ ...values, status: status.value })}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="ticket-start">Desde</Label>
              <Input
                id="ticket-start"
                type="date"
                required
                value={values.start}
                onChange={(event) =>
                  onChange({ ...values, start: event.target.value })
                }
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="ticket-end">Hasta</Label>
              <Input
                id="ticket-end"
                type="date"
                required
                value={values.end}
                onChange={(event) =>
                  onChange({ ...values, end: event.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-amount">Importe exacto</Label>
            <Input
              id="ticket-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="Cualquier importe"
              value={values.amount}
              onChange={(event) =>
                onChange({ ...values, amount: event.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-folio">Folio</Label>
            <Input
              id="ticket-folio"
              placeholder="Ej. a12b34cd"
              autoComplete="off"
              spellCheck={false}
              value={values.folio}
              aria-describedby="ticket-folio-help"
              onChange={(event) =>
                onChange({ ...values, folio: event.target.value })
              }
            />
            <p id="ticket-folio-help" className="text-muted-foreground text-xs">
              Desde 4 caracteres del folio impreso.
            </p>
          </div>
          <Button type="submit" className="w-full">
            <Search />
            Buscar tickets
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => apply(initialTicketValues())}
          >
            Restablecer filtros
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {dirty && !error && (
          <p className="text-muted-foreground text-xs">
            Cambios sin aplicar. Pulsa Buscar tickets.
          </p>
        )}
      </fieldset>
    </form>
  )
}
