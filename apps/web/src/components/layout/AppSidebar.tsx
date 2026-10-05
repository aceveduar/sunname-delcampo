import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navigationItems } from './navigation'
import type { ModuleKey } from '@/features/settings/useTenantModules'

export function AppSidebar({
  isAdmin,
  isOwner,
  isLargeText,
  isModuleEnabled,
}: {
  isAdmin: boolean
  isOwner: boolean
  isLargeText: boolean
  isModuleEnabled: (key: ModuleKey) => boolean
}) {
  const { pathname } = useLocation()
  const [preference, setPreference] = useState<boolean | null>(null)
  const collapsed = preference ?? (pathname === '/caja' || isLargeText)
  const items = navigationItems(isAdmin, isOwner, isModuleEnabled)
  return (
    <aside
      className={
        'bg-card sticky top-0 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col overflow-y-auto border-r p-3 xl:flex ' +
        (collapsed ? 'w-20' : 'w-56')
      }
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        {!collapsed && (
          <p className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
            Tu espacio
          </p>
        )}
        <button
          type="button"
          className="hover:bg-muted focus-visible:outline-ring flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2"
          aria-expanded={!collapsed}
          aria-controls="sidebar-navigation"
          aria-label={collapsed ? 'Expandir navegación' : 'Plegar navegación'}
          title={collapsed ? 'Expandir navegación' : 'Plegar navegación'}
          onClick={() => setPreference(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </button>
      </div>
      <nav
        id="sidebar-navigation"
        aria-label="Navegación principal"
        className="space-y-1"
      >
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
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
        ))}
      </nav>
      {!collapsed && (
        <p className="text-muted-foreground mt-auto px-2 pt-8 text-xs">
          {isAdmin ? 'Administración y operación' : 'Operación diaria'}
        </p>
      )}
    </aside>
  )
}
