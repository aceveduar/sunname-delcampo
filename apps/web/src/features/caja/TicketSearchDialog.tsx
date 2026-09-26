import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
const Content = lazy(() =>
  import('./TicketSearchContent').then((module) => ({
    default: module.TicketSearchContent,
  })),
)
export function TicketSearchDialog() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Buscar tickets
      </Button>
      {open && (
        <Suspense fallback={<span role="status">Cargando buscador…</span>}>
          <Content onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
