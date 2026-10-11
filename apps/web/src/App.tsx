import { ModuleRecovery } from '@/components/integrations/ModuleRecovery'
import { LoadError } from '@/components/LoadError'
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary'
import { SafeAppUpdate } from '@/components/integrations/SafeAppUpdate'
import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AppShell } from '@/components/layout/AppShell'
import { useTenantModules } from '@/features/settings/useTenantModules'
import { CartProvider } from '@/features/caja/CartContext'
import { isAdminRole, isOwnerRole } from '@/lib/roles'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'

const CustomerPurchaseHistory = lazy(() =>
  import('@/features/caja/CustomerPurchaseHistory').then((module) => ({
    default: module.CustomerPurchaseHistory,
  })),
)

const OperationsHome = lazy(() =>
  import('@/components/integrations/OperationsHome').then((module) => ({
    default: module.OperationsHome,
  })),
)

const ReplenishmentOrder = lazy(() =>
  import('@/components/integrations/ReplenishmentOrder').then((module) => ({
    default: module.ReplenishmentOrder,
  })),
)
const SaleReceiptViewer = lazy(() =>
  import('@/features/caja/SaleReceiptViewer').then((module) => ({
    default: module.SaleReceiptViewer,
  })),
)

const CatalogPage = lazy(() =>
  import('@/features/catalog/CatalogPage').then((module) => ({
    default: module.CatalogPage,
  })),
)
const CajaPage = lazy(() =>
  import('@/features/caja/CajaPage').then((module) => ({
    default: module.CajaPage,
  })),
)
const BillingPage = lazy(() =>
  import('@/features/billing/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
const CustomersPage = lazy(() =>
  import('@/features/crm/CustomersPage').then((module) => ({
    default: module.CustomersPage,
  })),
)
const InventoryPage = lazy(() =>
  import('@/features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  })),
)
const PurchasingPage = lazy(() =>
  import('@/features/purchasing/PurchasingPage').then((module) => ({
    default: module.PurchasingPage,
  })),
)
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((module) => ({
    default: module.UsersPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

function App() {
  const { session, profile, loading, toggleLargeText } = useAuth()

  // Un solo lugar aplica el atributo que dispara el CSS de modo texto
  // grande (index.css) -- así se agranda la app entera con un cambio, sin
  // repetirlo pantalla por pantalla.
  useEffect(() => {
    const root = document.documentElement
    if (profile?.large_text_mode) {
      root.setAttribute('data-text-size', 'lg')
    } else {
      root.removeAttribute('data-text-size')
    }
  }, [profile?.large_text_mode])

  // No se resuelven rutas antes de conocer la sesión y el perfil.
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-muted-foreground">Cargando…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-primary text-3xl font-semibold">Sunname ERP</h1>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <p className="text-muted-foreground text-sm">
              Entra con tu cuenta para continuar.
            </p>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <Workspace
      key={session.user.id}
      session={session}
      profile={profile}
      toggleLargeText={toggleLargeText}
    />
  )
}

/** El estado de módulos se comparte con Configuración y se descarta al cambiar de usuario. */
function Workspace({
  session,
  profile,
  toggleLargeText,
}: {
  session: NonNullable<ReturnType<typeof useAuth>['session']>
  profile: ReturnType<typeof useAuth>['profile']
  toggleLargeText: ReturnType<typeof useAuth>['toggleLargeText']
}) {
  const location = useLocation()
  const tenantModules = useTenantModules()
  const {
    isEnabled: isModuleEnabled,
    loading: modulesLoading,
    modules,
    error,
    refresh,
  } = tenantModules
  if (!modules) {
    return (
      <main className="mx-auto max-w-lg p-8">
        {modulesLoading && !error && <p role="status">Cargando módulos…</p>}
        <LoadError message={error} onRetry={refresh} loading={modulesLoading} />
      </main>
    )
  }

  const isAdmin = isAdminRole(profile?.role)
  const isOwner = isOwnerRole(profile?.role)

  return (
    <AppShell
      session={session}
      profile={profile}
      isModuleEnabled={isModuleEnabled}
      onToggleLargeText={toggleLargeText}
    >
      <CartProvider key={session.user.id} userId={session.user.id}>
        <SafeAppUpdate />
        <ModuleErrorBoundary
          key={location.pathname}
          fallback={(retry) => (
            <ModuleRecovery userId={session.user.id} retry={retry} />
          )}
        >
          <Suspense
            fallback={
              <p role="status" className="text-muted-foreground py-8">
                Cargando módulo…
              </p>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate to={isAdmin ? '/inicio' : '/caja'} replace />
                }
              />
              <Route
                path="/inicio"
                element={
                  isAdmin ? (
                    <OperationsHome
                      purchasingEnabled={isModuleEnabled('purchasing')}
                    />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/caja"
                element={
                  <CajaPage
                    role={profile?.role ?? null}
                    userId={session.user.id}
                  />
                }
              />
              <Route
                path="/catalogo"
                element={<CatalogPage role={profile?.role ?? null} />}
              />
              <Route
                path="/inventario"
                element={
                  <InventoryPage
                    role={profile?.role ?? null}
                    renderReplenishment={
                      isModuleEnabled('purchasing')
                        ? (rows, minimums, disabled) => (
                            <Suspense
                              fallback={<p role="status">Cargando compras…</p>}
                            >
                              <ReplenishmentOrder
                                rows={rows}
                                minimums={minimums}
                                disabled={disabled}
                              />
                            </Suspense>
                          )
                        : undefined
                    }
                  />
                }
              />
              <Route
                path="/clientes"
                element={
                  isModuleEnabled('crm') ? (
                    <CustomersPage
                      renderHistory={(customerId) => (
                        <Suspense
                          fallback={<p role="status">Cargando compras…</p>}
                        >
                          <CustomerPurchaseHistory
                            key={customerId}
                            customerId={customerId}
                          />
                        </Suspense>
                      )}
                    />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/compras"
                element={
                  isAdmin && isModuleEnabled('purchasing') ? (
                    <PurchasingPage userId={session.user.id} />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/reportes"
                element={
                  isAdmin ? (
                    <ReportsPage
                      renderReceipt={(saleId, onClose) => (
                        <SaleReceiptViewer
                          key={saleId}
                          saleId={saleId}
                          onClose={onClose}
                        />
                      )}
                    />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/facturacion"
                element={
                  isAdmin && isModuleEnabled('billing') ? (
                    <BillingPage canConfigure={isOwner} />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/usuarios"
                element={
                  isAdmin ? (
                    <UsersPage currentUserId={session.user.id} />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route
                path="/configuracion"
                element={
                  isOwner ? (
                    <SettingsPage tenantModules={tenantModules} />
                  ) : (
                    <Navigate to="/caja" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/caja" replace />} />
            </Routes>
          </Suspense>
        </ModuleErrorBoundary>
      </CartProvider>
    </AppShell>
  )
}

export default App
