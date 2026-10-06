import { AppSidebar } from './AppSidebar'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppNavigation } from './AppNavigation'
import { useTheme } from 'next-themes'
import { ALargeSmall, LogOut, Moon, Sun, Layers3 } from 'lucide-react'
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
  onToggleLargeText,
  children,
}: {
  session: Session
  profile: Profile | null
  isModuleEnabled: (key: ModuleKey) => boolean
  onToggleLargeText: () => void
  children: ReactNode
}) {
  const displayName = profile?.full_name ?? session.user.email ?? 'Usuario'
  const isLargeText = profile?.large_text_mode ?? false
  const isAdmin = isAdminRole(profile?.role)
  const isOwner = isOwnerRole(profile?.role)
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="app-workspace min-h-screen">
      <a
        href="#main-content"
        className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:p-3"
      >
        Saltar al contenido
      </a>
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border border-b shadow-sm">
        <div className="flex min-h-14 flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2.5 text-sm font-semibold tracking-wide">
            <span
              aria-hidden
              className="bg-sidebar-primary/15 text-sidebar-primary ring-sidebar-primary/30 flex size-8 items-center justify-center rounded-lg ring-1"
            >
              <Layers3 className="size-5" />
            </span>
            <span>
              Sunname <span className="font-normal opacity-70">ERP</span>
            </span>
          </div>

          <div className="order-last flex shrink-0 sm:order-none sm:ml-auto xl:hidden">
            <AppNavigation
              isAdmin={isAdmin}
              isOwner={isOwner}
              isLargeText={isLargeText}
              isModuleEnabled={isModuleEnabled}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:ml-2 xl:ml-auto">
            <button
              onClick={onToggleLargeText}
              className={`hover:bg-sidebar-accent flex items-center justify-center rounded-md p-2 ${
                isLargeText ? 'text-sidebar-primary' : ''
              }`}
              aria-pressed={isLargeText}
              aria-label={
                isLargeText ? 'Desactivar texto grande' : 'Activar texto grande'
              }
              title={
                isLargeText ? 'Desactivar texto grande' : 'Activar texto grande'
              }
            >
              <ALargeSmall className="size-4" />
            </button>

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
                  <button
                    aria-label={`Cuenta de ${displayName}`}
                    className="hover:bg-sidebar-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  />
                }
              >
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                  {initials(displayName)}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">
                  {displayName}
                </span>
              </DropdownMenuTrigger>
              {/* Mismo ajuste de ancho que el menú hamburguesa: sin
                  w-56 el nombre y el rol se partían a la mitad contra
                  el ancho del botón (solo iniciales en mobile). */}
              <DropdownMenuContent align="end" className="w-56">
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
                  className="py-2"
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

      <div className="flex items-start">
        <AppSidebar
          key={session.user.id}
          userId={session.user.id}
          isAdmin={isAdmin}
          isOwner={isOwner}
          isLargeText={isLargeText}
          isModuleEnabled={isModuleEnabled}
        />
        <div className="min-w-0 flex-1">
          <ConnectionStatus />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
