import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { sessionAge } from './sessionAge'

export function CashSessionStatus({
  openedAt,
  openingAmount,
}: {
  openedAt: string
  openingAmount: number
}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const age = sessionAge(openedAt, now)
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="bg-success size-1.5 rounded-full" />
        Abierta
        {age && (
          <>
            {' '}
            <time dateTime={openedAt}>{age.openedLabel}</time>
          </>
        )}
      </span>
      {age && <span className="whitespace-nowrap">· {age.elapsed}</span>}
      <span className="whitespace-nowrap">
        · Fondo {formatCurrency(openingAmount)}
      </span>
      {age?.isLongRunning && (
        <span className="bg-brand-gold/10 text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs">
          <Clock3 aria-hidden className="text-brand-gold size-3.5 shrink-0" />
          24 h o más abierta · Revisa el cierre
        </span>
      )}
    </span>
  )
}
