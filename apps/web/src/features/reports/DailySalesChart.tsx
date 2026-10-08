import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChartColumn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { reportDay } from './reportPresentation'
import type { DailySales } from './reportTypes'

const DAYS_PER_VIEW = 7
export function DailySalesChart({ days }: { days: DailySales[] }) {
  const [page, setPage] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const lastPage = Math.max(0, Math.ceil(days.length / DAYS_PER_VIEW) - 1)
  const currentPage = Math.min(page, lastPage)
  const end = days.length - currentPage * DAYS_PER_VIEW
  const visible = days.slice(Math.max(0, end - DAYS_PER_VIEW), end)
  const selected =
    visible.find((day) => day.date === selectedDate) ?? visible.at(-1)
  const maximum = days.reduce((max, day) => Math.max(max, day.amount), 0)
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row">
        <div className="space-y-1">
          <CardTitle>Ventas por día</CardTitle>
          <p className="text-muted-foreground text-xs">
            Ventas completadas. Selecciona un día para ver su detalle.
          </p>
        </div>
        {days.length > DAYS_PER_VIEW && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Ver días anteriores"
              disabled={currentPage >= lastPage}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Ver días siguientes"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!selected || days.every((day) => day.count === 0) ? (
          <div className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm">
            <ChartColumn aria-hidden className="size-8" />
            <p>Sin ventas completadas en este periodo.</p>
          </div>
        ) : (
          <>
            <div
              className="bg-muted/45 flex flex-wrap items-center justify-between gap-2 rounded-xl p-3"
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <p className="text-sm font-medium">
                  {reportDay(selected.date)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {selected.count}{' '}
                  {selected.count === 1
                    ? 'ticket completado'
                    : 'tickets completados'}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(selected.amount)}
              </p>
            </div>
            <p className="text-muted-foreground text-right text-xs">
              Escala hasta {formatCurrency(maximum)}
            </p>
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-40 border-y border-dashed"
              >
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed" />
              </div>
              <div
                className="relative grid gap-1 sm:gap-3"
                style={{
                  gridTemplateColumns:
                    'repeat(' + visible.length + ', minmax(0, 1fr))',
                }}
              >
                {visible.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className="group min-w-0 rounded-md px-1 text-center"
                    aria-label={
                      reportDay(day.date) +
                      ': ' +
                      formatCurrency(day.amount) +
                      ', ' +
                      day.count +
                      (day.count === 1 ? ' ticket' : ' tickets')
                    }
                    aria-pressed={day.date === selected.date}
                    onClick={() => setSelectedDate(day.date)}
                    onFocus={() => setSelectedDate(day.date)}
                  >
                    <span className="flex h-40 items-end justify-center pb-px">
                      <span
                        aria-hidden
                        className={
                          'w-full max-w-14 rounded-t-md motion-safe:transition-colors ' +
                          (day.date === selected.date
                            ? 'bg-brand-gold'
                            : 'bg-primary/70 group-hover:bg-primary')
                        }
                        style={{
                          height:
                            day.amount > 0
                              ? Math.max(2, (day.amount / maximum) * 100) + '%'
                              : '2px',
                        }}
                      />
                    </span>
                    <span className="text-muted-foreground mt-2 block text-[0.65rem] sm:text-xs">
                      {reportDay(day.date, true)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Mostrando {reportDay(visible[0].date, true)} al{' '}
              {reportDay(visible[visible.length - 1].date, true)}. La escala
              corresponde a todo el periodo.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
