import {
  Boxes,
  LoaderCircle,
  MoreHorizontal,
  Power,
  Tag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Product } from './useProducts'

export function ProductActions({
  product,
  canDelete,
  disabled = false,
  pendingLabel,
  onEdit,
  onToggle,
  onLabel,
  onStock,
  onDelete,
}: {
  product: Product
  canDelete: boolean
  disabled?: boolean
  pendingLabel?: string
  onEdit: () => void
  onToggle: () => void
  onLabel: () => void
  onStock: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {pendingLabel && (
        <span
          role="status"
          className="text-muted-foreground flex items-center gap-1 text-xs"
        >
          <LoaderCircle className="size-3 animate-spin" />
          {pendingLabel}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onEdit}
        disabled={disabled}
        aria-label={`Editar ${product.name}`}
      >
        Editar
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={`Más acciones de ${product.name}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={disabled} onClick={onLabel}>
            <Tag />
            Imprimir etiqueta
          </DropdownMenuItem>
          {product.track_inventory && (
            <DropdownMenuItem disabled={disabled} onClick={onStock}>
              <Boxes />
              Ajustar existencia
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={disabled} onClick={onToggle}>
            <Power />
            {product.active ? 'Desactivar producto' : 'Activar producto'}
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem disabled={disabled} onClick={onDelete}>
              <Trash2 />
              Borrar producto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
