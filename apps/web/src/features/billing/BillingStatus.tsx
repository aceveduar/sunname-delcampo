import { Badge } from '@/components/ui/badge'
import { BILLING_STATUSES, type Invoice } from './billingData'

export function BillingStatus({ invoice }: { invoice: Invoice | null }) {
  const label = BILLING_STATUSES.find(
    (item) => item.value === (invoice?.status ?? 'none'),
  )!.label
  return (
    <Badge
      variant={invoice?.status === 'error' ? 'destructive' : 'outline'}
      className={
        invoice?.status === 'stamped'
          ? 'bg-success/10 text-success border-success/20'
          : ''
      }
    >
      {label}
    </Badge>
  )
}
