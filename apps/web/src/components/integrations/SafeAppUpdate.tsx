import { useCart } from '@/features/caja/CartContext'
import { AppUpdateNotice } from '@/components/AppUpdateNotice'

export function SafeAppUpdate() {
  const { cart, pendingDraft } = useCart()
  return <AppUpdateNotice hasPendingSale={cart.length > 0 || !!pendingDraft} />
}
