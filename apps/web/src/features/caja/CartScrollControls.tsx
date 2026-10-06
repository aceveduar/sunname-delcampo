import type { RefObject } from 'react'
import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CartScrollControls({
  listRef,
  listId,
  canScrollUp,
  canScrollDown,
}: {
  listRef: RefObject<HTMLDivElement | null>
  listId: string
  canScrollUp: boolean
  canScrollDown: boolean
}) {
  const move = (end: boolean) => {
    const list = listRef.current
    if (list) list.scrollTo({ top: end ? list.scrollHeight : 0 })
  }
  return (
    <div
      className={
        'flex shrink-0 items-center gap-0.5 ' +
        (!canScrollUp && !canScrollDown ? 'invisible' : '')
      }
      role="group"
      aria-label="Desplazar productos de la venta"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        disabled={!canScrollUp}
        aria-controls={listId}
        aria-label="Ver inicio de la venta"
        title="Hay productos arriba: ver inicio"
        onClick={() => move(false)}
      >
        <ArrowUpToLine />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        disabled={!canScrollDown}
        aria-controls={listId}
        aria-label="Ver final de la venta"
        title="Hay productos abajo: ver final"
        onClick={() => move(true)}
      >
        <ArrowDownToLine />
      </Button>
    </div>
  )
}
