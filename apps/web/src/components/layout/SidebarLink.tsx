import { Tooltip } from '@base-ui/react/tooltip'
import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export function SidebarLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string
  label: string
  icon: LucideIcon
  collapsed: boolean
}) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        'focus-visible:outline-ring flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium focus-visible:outline-2 ' +
        (isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={link} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="right" sideOffset={10} className="z-50">
          <Tooltip.Popup className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-sm shadow-md">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
