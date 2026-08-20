import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, NavLink } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Contact,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
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
  { to: '/clientes', label: 'Clientes', icon: Contact, adminOnly: false, moduleKey: 'crm' },
  { to: '/compras', label: 'Compras', icon: ShoppingCart, adminOnly: true, moduleKey: 'purchasing' },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { to: '/configuracion', label: 'Configuración', icon: Settings, adminOnly: true, ownerOnly: true },
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
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.ownerOnly || isOwner) &&
      (!item.moduleKey || isModuleEnabled(item.moduleKey)),
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold tracking-wide">Sunname ERP</span>
            <nav className="hidden items-center gap-1 md:flex">
              {visibleNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center justify-center rounded-md p-2 hover:bg-sidebar-accent md:hidden" />
                }
              >
                <Menu className="size-5" />
                <span className="sr-only">Menú</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  {visibleNavItems.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} render={<Link to={to} />}>
                      <Icon /> {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent" />
                }
              >
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                  {initials(displayName)}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
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
                <DropdownMenuItem onClick={() => supabase.auth.signOut()} variant="destructive">
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
