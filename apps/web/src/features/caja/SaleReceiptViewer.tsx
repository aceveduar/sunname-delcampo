import { useCallback, type RefObject } from 'react'
import { LoadError } from '@/components/LoadError'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { ReceiptDialog, type ReceiptData } from './ReceiptDialog'
import { fetchSaleReceipt } from './saleReceipt'
export function SaleReceiptViewer({
  saleId,
  onClose,
  returnFocus,
}: {
  saleId: string
  onClose: () => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  const fetcher = useCallback(() => fetchSaleReceipt(saleId), [saleId])
  const { data, error, loading, refresh } =
    useAsyncResource<ReceiptData | null>(
      fetcher,
      'No se pudo cargar el ticket',
      null,
    )
  if (data)
    return (
      <ReceiptDialog
        receipt={data}
        onClose={onClose}
        returnFocus={returnFocus}
        copy
      />
    )
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent finalFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>Consultar ticket</DialogTitle>
        </DialogHeader>
        {loading && <p role="status">Cargando ticket…</p>}
        <LoadError message={error} loading={loading} onRetry={refresh} />
      </DialogContent>
    </Dialog>
  )
}
