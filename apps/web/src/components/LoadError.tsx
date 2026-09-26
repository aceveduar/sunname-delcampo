import { Button } from '@/components/ui/button'

export function LoadError({
  message,
  onRetry,
  loading = false,
}: {
  message: string | null
  onRetry: () => void
  loading?: boolean
}) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
    >
      <div>
        <p className="text-destructive text-sm font-medium">{message}</p>
        <p className="text-muted-foreground text-xs">
          Si ya había datos, se conserva la última carga correcta.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={loading}>
        {loading ? 'Reintentando…' : 'Reintentar'}
      </Button>
    </div>
  )
}
