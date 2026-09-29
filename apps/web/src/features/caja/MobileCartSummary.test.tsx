import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MobileCartSummary } from './MobileCartSummary'

afterEach(cleanup)
it('lleva a revisar el pago sin cobrar cuando faltan datos', () => {
  const onOpen = vi.fn()
  const onCheckout = vi.fn()
  render(
    <MobileCartSummary
      total={50}
      canCheckout={false}
      submitting={false}
      onOpen={onOpen}
      onCheckout={onCheckout}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Revisar pago' }))
  expect(onOpen).toHaveBeenCalledOnce()
  expect(onCheckout).not.toHaveBeenCalled()
})
it('usa el mismo cobro cuando está listo y conserva acceso al carrito', () => {
  const onOpen = vi.fn()
  const onCheckout = vi.fn()
  render(
    <MobileCartSummary
      total={50}
      canCheckout
      submitting={false}
      onOpen={onOpen}
      onCheckout={onCheckout}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ver carrito' }))
  expect(onCheckout).toHaveBeenCalledOnce()
  expect(onOpen).toHaveBeenCalledOnce()
})
it('impide un segundo envío durante el cobro', () => {
  const onCheckout = vi.fn()
  render(
    <MobileCartSummary
      total={50}
      canCheckout={false}
      submitting
      onOpen={vi.fn()}
      onCheckout={onCheckout}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cobrando…' }))
  expect(onCheckout).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Cobrando…' })).toBeDisabled()
})
