import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSaleShortcuts } from './useSaleShortcuts'

afterEach(cleanup)

describe('Atajos de Caja', () => {
  it('bloquea F9 con diálogos abiertos y usa el estado actualizado al cerrarlos', () => {
    const onCheckout = vi.fn()
    const props = {
      onCheckout,
      onSearch: vi.fn(),
      onClearSearch: vi.fn(),
      checkoutDisabled: false,
      dialogOpen: true,
    }
    const { rerender } = renderHook(useSaleShortcuts, { initialProps: props })
    fireEvent.keyDown(window, { key: 'F9' })
    expect(onCheckout).not.toHaveBeenCalled()
    rerender({ ...props, dialogOpen: false })
    fireEvent.keyDown(window, { key: 'F9' })
    expect(onCheckout).toHaveBeenCalledTimes(1)
    rerender({ ...props, dialogOpen: false, checkoutDisabled: true })
    fireEvent.keyDown(window, { key: 'F9' })
    expect(onCheckout).toHaveBeenCalledTimes(1)
  })

  it('respeta diálogos externos y no repite el cobro al mantener pulsada F9', () => {
    const onCheckout = vi.fn()
    const onSearch = vi.fn()
    renderHook(() =>
      useSaleShortcuts({
        onCheckout,
        onSearch,
        onClearSearch: vi.fn(),
        checkoutDisabled: false,
        dialogOpen: false,
      }),
    )
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    fireEvent.keyDown(window, { key: 'F9' })
    fireEvent.keyDown(window, { key: 'F2' })
    expect(onCheckout).not.toHaveBeenCalled()
    expect(onSearch).not.toHaveBeenCalled()
    dialog.remove()
    fireEvent.keyDown(window, { key: 'F9', repeat: true })
    expect(onCheckout).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'F2' })
    expect(onSearch).toHaveBeenCalledOnce()
  })
})
