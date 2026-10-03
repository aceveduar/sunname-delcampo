import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ModuleRecovery } from './ModuleRecovery'
const state = vi.hoisted(() => ({
  writes: 0,
  cart: {
    cart: [{ product: { id: 'a' }, quantity: 1 }],
    pendingDraft: null,
    storageError: false,
  },
}))
vi.mock('@/features/caja/CartContext', () => ({ useCart: () => state.cart }))
vi.mock('@/lib/pendingWrites', () => ({ usePendingWrites: () => state.writes }))
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  state.writes = 0
})
it('bloquea recarga sin respaldo y permite reintentar sin borrar la venta', () => {
  const retry = vi.fn()
  render(<ModuleRecovery userId="one" retry={retry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Recargar aplicación' }))
  expect(
    screen.getByText(/No se pudo verificar el respaldo/),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(state.cart.cart).toHaveLength(1)
})
it('bloquea acciones con escrituras en curso', () => {
  state.writes = 1
  render(<ModuleRecovery userId="one" retry={vi.fn()} />)
  expect(
    screen.getByRole('button', { name: 'Recargar aplicación' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled()
})
