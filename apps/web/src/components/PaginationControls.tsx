import { Button } from '@/components/ui/button'

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalItems === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        {from}–{to} de {totalItems}
        {totalPages > 1 && ` · página ${page} de ${totalPages}`}
      </p>
      {/* Con una sola página, "Anterior"/"Siguiente" solo serían dos
          botones deshabilitados sin ningún uso -- se ocultan, el conteo
          de arriba ya dice todo lo que hace falta. */}
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  )
}
