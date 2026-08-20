import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { CajaPage } from '@/features/caja/CajaPage'
import { CustomersPage } from '@/features/crm/CustomersPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { PurchasingPage } from '@/features/purchasing/PurchasingPage'
import { UsersPage } from '@/features/users/UsersPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useTenantModules } from '@/features/settings/useTenantModules'
import { isAdminRole, isOwnerRole } from '@/lib/roles'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'

function App() {
  const { session, profile, loading } = useAuth()
  const { isEnabled: isModuleEnabled } = useTenantModules(!!session)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Cargando…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-primary text-3xl font-semibold">Sunname ERP</h1>
        <LoginForm />
      </main>
    )
  }

  const isAdmin = isAdminRole(profile?.role)
  const isOwner = isOwnerRole(profile?.role)

  return (
    <AppShell session={session} profile={profile} isModuleEnabled={isModuleEnabled}>
      <Routes>
        <Route path="/" element={<Navigate to="/caja" replace />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/catalogo" element={<CatalogPage role={profile?.role ?? null} />} />
        <Route path="/inventario" element={<InventoryPage role={profile?.role ?? null} />} />
        <Route
          path="/clientes"
          element={isModuleEnabled('crm') ? <CustomersPage /> : <Navigate to="/caja" replace />}
        />
        <Route
          path="/compras"
          element={
            isAdmin && isModuleEnabled('purchasing') ? (
              <PurchasingPage />
            ) : (
              <Navigate to="/caja" replace />
            )
          }
        />
        <Route
          path="/reportes"
          element={isAdmin ? <ReportsPage /> : <Navigate to="/caja" replace />}
        />
        <Route
          path="/usuarios"
          element={isAdmin ? <UsersPage currentUserId={session.user.id} /> : <Navigate to="/caja" replace />}
        />
        <Route
          path="/configuracion"
          element={isOwner ? <SettingsPage /> : <Navigate to="/caja" replace />}
        />
        <Route path="*" element={<Navigate to="/caja" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
