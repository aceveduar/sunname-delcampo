import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 py-10 text-center',
        className,
      )}
    >
      <div className="bg-primary/6 text-primary ring-primary/10 mb-2 flex size-16 items-center justify-center rounded-2xl ring-1">
        <Icon className="size-7" />
      </div>
      <p className="text-foreground text-base font-semibold">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      )}
    </div>
  )
}
