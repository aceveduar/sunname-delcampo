import {
  BarChart3,
  Boxes,
  Contact,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react'
import type { ModuleKey } from '@/features/settings/useTenantModules'
const NAV_ITEMS: {
  to: string
  label: string
  icon: typeof Store
  adminOnly: boolean
  ownerOnly?: boolean
  moduleKey?: ModuleKey
}[] = [
  { to: '/inicio', label: 'Inicio', icon: LayoutDashboard, adminOnly: true },
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

export function navigationItems(
  isAdmin: boolean,
  isOwner: boolean,
  isModuleEnabled: (key: ModuleKey) => boolean,
) {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.ownerOnly || isOwner) &&
      (!item.moduleKey || isModuleEnabled(item.moduleKey)),
  )
}
