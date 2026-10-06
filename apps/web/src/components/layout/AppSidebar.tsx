import { Tooltip } from '@base-ui/react/tooltip'
import { SidebarLink } from './SidebarLink'
import { useSidebarPreference } from './useSidebarPreference'
import { useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navigationItems } from './navigation'
import type { ModuleKey } from '@/features/settings/useTenantModules'

export function AppSidebar({
  userId,
  isAdmin,
  isOwner,
  isLargeText,
  isModuleEnabled,
}: {
  userId: string
  isAdmin: boolean
  isOwner: boolean
  isLargeText: boolean
  isModuleEnabled: (key: ModuleKey) => boolean
}) {
  const { pathname } = useLocation()
  const { collapsed, toggle } = useSidebarPreference(
    userId,
    pathname === '/caja',
    isLargeText,
  )
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
          onClick={toggle}
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
        <Tooltip.Provider delay={200}>
          {items.map((item) => (
            <SidebarLink key={item.to} {...item} collapsed={collapsed} />
          ))}
        </Tooltip.Provider>
      </nav>
      {!collapsed && (
        <p className="text-muted-foreground mt-auto px-2 pt-8 text-xs">
          {isAdmin ? 'Administración y operación' : 'Operación diaria'}
        </p>
      )}
    </aside>
  )
}
