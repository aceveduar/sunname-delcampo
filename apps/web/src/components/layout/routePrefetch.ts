import {
  OperationsHome,
  CajaPage,
  CatalogPage,
  InventoryPage,
  CustomersPage,
  PurchasingPage,
  ReportsPage,
  BillingPage,
  UsersPage,
  SettingsPage,
} from './routePages'
const loaders: Record<string, () => Promise<unknown>> = {
  '/inicio': OperationsHome.preload,
  '/caja': CajaPage.preload,
  '/catalogo': CatalogPage.preload,
  '/inventario': InventoryPage.preload,
  '/clientes': CustomersPage.preload,
  '/compras': PurchasingPage.preload,
  '/reportes': ReportsPage.preload,
  '/facturacion': BillingPage.preload,
  '/usuarios': UsersPage.preload,
  '/configuracion': SettingsPage.preload,
}
const pending = new Map<string, Promise<void>>()

/** Solo código: nunca monta pantallas ni consulta datos. Los fallos se pueden reintentar. */
export function prefetchRoute(path: string) {
  if (!loaders[path]) return Promise.resolve()
  const previous = pending.get(path)
  if (previous) return previous
  const request = loaders[path]().then(
    () => {},
    () => {
      pending.delete(path)
    },
  )
  pending.set(path, request)
  return request
}

export function canPrefetchRoute() {
  if (!navigator.onLine) return false
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  return (
    !connection?.saveData &&
    !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')
  )
}
