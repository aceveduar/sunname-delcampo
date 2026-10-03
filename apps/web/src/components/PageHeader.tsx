import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Identidad del módulo con espacio para sus acciones, sin duplicar navegación. */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  actions?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        compact ? 'py-1' : 'module-heading rounded-2xl border p-5 sm:p-6',
      )}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div
          aria-hidden
          className={cn(
            'text-primary bg-primary/8 ring-primary/10 flex shrink-0 items-center justify-center rounded-xl ring-1',
            compact ? 'size-10' : 'size-12',
          )}
        >
          <Icon className={compact ? 'size-5' : 'size-6'} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <div className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
            {description}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  )
}
