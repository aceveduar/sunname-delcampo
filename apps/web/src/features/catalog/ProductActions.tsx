import { Boxes, MoreHorizontal, Power, Tag, Trash2 } from 'lucide-react'
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
  onEdit,
  onToggle,
  onLabel,
  onStock,
  onDelete,
}: {
  product: Product
  canDelete: boolean
  onEdit: () => void
  onToggle: () => void
  onLabel: () => void
  onStock: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={onEdit}
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
              aria-label={`Más acciones de ${product.name}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onLabel}>
            <Tag /> Imprimir etiqueta
          </DropdownMenuItem>
          {product.track_inventory && (
            <DropdownMenuItem onClick={onStock}>
              <Boxes /> Ajustar existencia
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onToggle}>
            <Power />{' '}
            {product.active ? 'Desactivar producto' : 'Activar producto'}
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 /> Borrar producto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
