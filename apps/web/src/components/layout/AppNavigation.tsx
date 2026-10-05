import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { navigationItems } from './navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ModuleKey } from '@/features/settings/useTenantModules'

export function AppNavigation({
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
  const visibleItems = navigationItems(isAdmin, isOwner, isModuleEnabled)
  const primaryItems = visibleItems.filter((item) => !item.adminOnly)
  const secondaryActive = visibleItems.some(
    (item) => item.adminOnly && item.to === pathname,
  )

  return (
    <nav
      aria-label="Navegación principal"
      className="flex min-w-0 items-center gap-1"
    >
      {!isLargeText &&
        primaryItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              'focus-visible:outline-sidebar-ring hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 xl:flex ' +
              (isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'hover:bg-sidebar-accent')
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className={
                'hover:bg-sidebar-accent hover:text-sidebar-foreground ' +
                (!isLargeText && !visibleItems.some((item) => item.adminOnly)
                  ? 'xl:hidden '
                  : '') +
                (secondaryActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : '')
              }
            />
          }
        >
          <Menu className="size-5" />
          <span
            className={
              isLargeText
                ? 'sr-only sm:not-sr-only'
                : 'sr-only sm:not-sr-only xl:hidden'
            }
          >
            Menú
          </span>
          {!isLargeText && <span className="hidden xl:inline">Más</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuGroup>
            {visibleItems.map(({ to, label, icon: Icon, adminOnly }) => (
              <DropdownMenuItem
                key={to}
                render={
                  <Link
                    to={to}
                    aria-current={pathname === to ? 'page' : undefined}
                  />
                }
                className={
                  (!isLargeText && !adminOnly ? 'xl:hidden ' : '') +
                  (pathname === to
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground focus:bg-sidebar-primary focus:text-sidebar-primary-foreground'
                    : '')
                }
              >
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
