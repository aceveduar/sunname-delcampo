import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { IntentLink } from './IntentLink'
const state = vi.hoisted(() => ({ allowed: true, prefetch: vi.fn() }))
vi.mock('./routePrefetch', () => ({
  canPrefetchRoute: () => state.allowed,
  prefetchRoute: state.prefetch,
}))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  state.allowed = true
  state.prefetch.mockReset()
})
function mount(to = '/inventario') {
  return render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <IntentLink to={to}>Destino</IntentLink>
    </MemoryRouter>,
  )
}
it('anticipa por foco tras intención sostenida y cancela al abandonar el enlace', () => {
  vi.useFakeTimers()
  mount()
  const link = screen.getByRole('link')
  fireEvent.focus(link)
  act(() => {
    vi.advanceTimersByTime(119)
  })
  expect(state.prefetch).not.toHaveBeenCalled()
  fireEvent.blur(link)
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(state.prefetch).not.toHaveBeenCalled()
  fireEvent.focus(link)
  act(() => {
    vi.advanceTimersByTime(120)
  })
  expect(state.prefetch).toHaveBeenCalledWith('/inventario')
})
it('respeta conexión limitada, ruta actual y desmontaje', () => {
  vi.useFakeTimers()
  state.allowed = false
  const first = mount()
  fireEvent.focus(screen.getByRole('link'))
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(state.prefetch).not.toHaveBeenCalled()
  first.unmount()
  state.allowed = true
  const current = mount('/catalogo')
  fireEvent.focus(screen.getByRole('link'))
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(state.prefetch).not.toHaveBeenCalled()
  current.unmount()
  const next = mount()
  fireEvent.focus(screen.getByRole('link'))
  next.unmount()
  act(() => {
    vi.advanceTimersByTime(200)
  })
  expect(state.prefetch).not.toHaveBeenCalled()
})
