import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DeferredImage } from './DeferredImage'

let callbacks: IntersectionObserverCallback[] = []
let observers: {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}[] = []
function observerSupport() {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
        observers.push(this)
      }
    },
  )
}
function visible(index: number, intersecting = true) {
  act(() =>
    callbacks[index](
      [{ isIntersecting: intersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  callbacks = []
  observers = []
})

it('conserva dimensiones y aplaza la solicitud hasta acercarse; no retira fotos ya cargadas', () => {
  observerSupport()
  const { rerender } = render(
    <DeferredImage src="/photo.jpg" alt="Producto" width={64} height={64} />,
  )
  const img = screen.getByRole('img')
  expect(img).not.toHaveAttribute('src')
  expect(img).toHaveAttribute('width', '64')
  expect(img).toHaveAttribute('height', '64')
  visible(0, false)
  expect(img).not.toHaveAttribute('src')
  visible(0)
  expect(img).toHaveAttribute('src', '/photo.jpg')
  expect(img).toHaveAttribute('decoding', 'async')
  expect(observers[0].disconnect).toHaveBeenCalled()
  rerender(
    <DeferredImage
      src="/photo.jpg"
      alt="Producto"
      width={64}
      height={64}
      className="changed"
    />,
  )
  expect(img).toHaveAttribute('src', '/photo.jpg')
  expect(observers).toHaveLength(1)
})
it('no muestra una foto anterior ni acepta callbacks tardíos al cambiar de producto', () => {
  observerSupport()
  const { rerender, unmount } = render(
    <DeferredImage src="/old.jpg" alt="Producto" />,
  )
  visible(0)
  rerender(<DeferredImage src="/new.jpg" alt="Producto" />)
  const img = screen.getByRole('img')
  expect(img).not.toHaveAttribute('src')
  visible(1)
  visible(0)
  expect(img).toHaveAttribute('src', '/new.jpg')
  unmount()
  expect(observers[1].disconnect).toHaveBeenCalled()
})
it('mantiene la carga nativa cuando el navegador no ofrece IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  render(<DeferredImage src="/photo.jpg" alt="Producto" />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/photo.jpg')
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy')
})
