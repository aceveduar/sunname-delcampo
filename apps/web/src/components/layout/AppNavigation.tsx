import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Contact,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ModuleKey } from '@/features/settings/useTenantModules'

const NAV_ITEMS: {
  to: string
  label: string
  icon: typeof Store
  adminOnly: boolean
  ownerOnly?: boolean
  moduleKey?: ModuleKey
}[] = [
  { to: '/caja', label: 'Caja', icon: Store, adminOnly: false },
  { to: '/catalogo', label: 'Catálogo', icon: Package, adminOnly: false },
  { to: '/inventario', label: 'Inventario', icon: Boxes, adminOnly: false },
  {
    to: '/clientes',
    label: 'Clientes',
    icon: Contact,
    adminOnly: false,
    moduleKey: 'crm',
  },
  {
    to: '/compras',
    label: 'Compras',
    icon: ShoppingCart,
    adminOnly: true,
    moduleKey: 'purchasing',
  },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, adminOnly: true },
  {
    to: '/facturacion',
    label: 'Facturación',
    icon: Receipt,
    adminOnly: true,
    moduleKey: 'billing',
  },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  {
    to: '/configuracion',
    label: 'Configuración',
    icon: Settings,
    adminOnly: true,
    ownerOnly: true,
  },
]

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
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.ownerOnly || isOwner) &&
      (!item.moduleKey || isModuleEnabled(item.moduleKey)),
  )
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
