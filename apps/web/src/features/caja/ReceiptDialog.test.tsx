import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReceiptDialog, type ReceiptData } from './ReceiptDialog'
vi.mock('@/features/settings/useTenantSettings', () => ({
  useTenantSettings: () => ({ businessName: 'Del Campo' }),
}))
afterEach(cleanup)
const receipt: ReceiptData = {
  saleId: '12345678',
  createdAt: '2026-10-01T12:00:00Z',
  lines: [],
  total: 141.5,
  cashReceived: 500,
  change: 358.5,
  paymentMethodName: 'Efectivo',
  customerName: null,
}
it('destaca cambio fuera del ticket impreso y permite iniciar otra venta', () => {
  const close = vi.fn()
  render(<ReceiptDialog receipt={receipt} onClose={close} />)
  const summary = screen.getByText('Entregar de cambio').parentElement!
  expect(summary).toHaveTextContent('$358.50')
  expect(summary.closest('[data-print-area]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Nueva venta' }))
  expect(close).toHaveBeenCalledOnce()
})
it('incluye cambio cero y omite instrucciones de entrega en copias', () => {
  const { rerender } = render(
    <ReceiptDialog receipt={{ ...receipt, change: 0 }} onClose={vi.fn()} />,
  )
  expect(
    screen.getByText('Entregar de cambio').parentElement,
  ).toHaveTextContent('$0.00')
  rerender(<ReceiptDialog receipt={receipt} copy onClose={vi.fn()} />)
  expect(screen.queryByText('Entregar de cambio')).toBeNull()
  expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
})
it('no pide entregar cambio en ventas anuladas ni pagos sin efectivo', () => {
  const { rerender } = render(
    <ReceiptDialog
      receipt={{ ...receipt, status: 'voided' }}
      onClose={vi.fn()}
    />,
  )
  expect(screen.queryByText('Entregar de cambio')).toBeNull()
  rerender(
    <ReceiptDialog
      receipt={{
        ...receipt,
        change: null,
        cashReceived: null,
        paymentMethodName: 'Tarjeta',
      }}
      onClose={vi.fn()}
    />,
  )
  expect(screen.getByText('Total pagado')).toBeInTheDocument()
  expect(screen.queryByText('Entregar de cambio')).toBeNull()
})
