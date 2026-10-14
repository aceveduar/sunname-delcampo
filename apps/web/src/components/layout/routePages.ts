import type { ComponentProps } from 'react'
import { createPreloadableRoute } from '@/lib/createPreloadableRoute'
export const OperationsHome = createPreloadableRoute<
  ComponentProps<
    typeof import('@/components/integrations/OperationsHome').OperationsHome
  >
>(() =>
  import('@/components/integrations/OperationsHome').then((module) => ({
    default: module.OperationsHome,
  })),
)
export const CajaPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/caja/CajaPage').CajaPage>
>(() =>
  import('@/features/caja/CajaPage').then((module) => ({
    default: module.CajaPage,
  })),
)
export const CatalogPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/catalog/CatalogPage').CatalogPage>
>(() =>
  import('@/features/catalog/CatalogPage').then((module) => ({
    default: module.CatalogPage,
  })),
)
export const InventoryPage = createPreloadableRoute<
  ComponentProps<
    typeof import('@/features/inventory/InventoryPage').InventoryPage
  >
>(() =>
  import('@/features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
)
export const CustomersPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/crm/CustomersPage').CustomersPage>
>(() =>
  import('@/features/crm/CustomersPage').then((module) => ({
    default: module.CustomersPage,
  })),
)
export const PurchasingPage = createPreloadableRoute<
  ComponentProps<
    typeof import('@/features/purchasing/PurchasingPage').PurchasingPage
  >
>(() =>
  import('@/features/purchasing/PurchasingPage').then((module) => ({
    default: module.PurchasingPage,
  })),
)
export const ReportsPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/reports/ReportsPage').ReportsPage>
>(() =>
  import('@/features/reports/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  })),
)
export const BillingPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/billing/BillingPage').BillingPage>
>(() =>
  import('@/features/billing/BillingPage').then((module) => ({
    default: module.BillingPage,
  })),
)
export const UsersPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/users/UsersPage').UsersPage>
>(() =>
  import('@/features/users/UsersPage').then((module) => ({
    default: module.UsersPage,
  })),
)
export const SettingsPage = createPreloadableRoute<
  ComponentProps<typeof import('@/features/settings/SettingsPage').SettingsPage>
>(() =>
  import('@/features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)
