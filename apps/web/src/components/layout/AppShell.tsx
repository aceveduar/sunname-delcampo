import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  BarChart3,
  Boxes,
  Contact,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Users,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { isAdminRole, isOwnerRole, ROLE_LABELS } from '@/lib/roles'
import type { ModuleKey } from '@/features/settings/useTenantModules'

type Profile = Database['public']['Tables']['profiles']['Row']

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

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function AppShell({
  session,
  profile,
  isModuleEnabled,
  children,
}: {
  session: Session
  profile: Profile | null
  isModuleEnabled: (key: ModuleKey) => boolean
  children: ReactNode
}) {
  const displayName = profile?.full_name ?? session.user.email ?? 'Usuario'
  const isAdmin = isAdminRole(profile?.role)
  const isOwner = isOwnerRole(profile?.role)
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.ownerOnly || isOwner) &&
      (!item.moduleKey || isModuleEnabled(item.moduleKey)),
  )

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
          <span className="justify-self-start text-sm font-semibold tracking-wide">
            Sunname ERP
          </span>

          {/* Centrada a propósito: así se ve igual de intencional con 3
              módulos activos que con 8 -- no se amontona a la izquierda
              dejando un vacío grande de un solo lado. */}
          <nav className="hidden items-center gap-1 justify-self-center md:flex">
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 justify-self-end">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="hover:bg-sidebar-accent relative flex items-center justify-center rounded-md p-2"
              aria-label={
                isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
              }
            >
              <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="hover:bg-sidebar-accent flex items-center justify-center rounded-md p-2 md:hidden" />
                }
              >
                <Menu className="size-5" />
                <span className="sr-only">Menú</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  {visibleNavItems.map(({ to, label, icon: Icon }) => {
                    const isActive = location.pathname === to
                    return (
                      <DropdownMenuItem
                        key={to}
                        render={<Link to={to} />}
                        className={
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground focus:bg-sidebar-primary focus:text-sidebar-primary-foreground'
                            : undefined
                        }
                      >
                        <Icon /> {label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" />
                }
              >
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                  {initials(displayName)}
                </span>
                <span className="hidden max-w-48 truncate sm:inline">
                  {displayName}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="font-medium">{displayName}</p>
                    <p className="text-muted-foreground text-xs font-normal">
                      {profile ? ROLE_LABELS[profile.role] : '—'}
                    </p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => supabase.auth.signOut()}
                  variant="destructive"
                >
                  <LogOut /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
