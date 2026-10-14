import { Suspense } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createPreloadableRoute } from './createPreloadableRoute'
afterEach(cleanup)
it('renderiza una ruta precargada sin volver al fallback ni invocar otra descarga', async () => {
  const loader = vi
    .fn()
    .mockResolvedValue({
      default: ({ name }: { name: string }) => <p>{name}</p>,
    })
  const Page = createPreloadableRoute<{ name: string }>(loader)
  const a = Page.preload()
  expect(Page.preload()).toBe(a)
  await a
  render(
    <Suspense fallback={<p>Cargando</p>}>
      <Page name="Inventario" />
    </Suspense>,
  )
  expect(screen.getByText('Inventario')).toBeInTheDocument()
  expect(screen.queryByText('Cargando')).toBeNull()
  expect(loader).toHaveBeenCalledTimes(1)
})
it('carga al entrar cuando no hubo anticipación', async () => {
  const loader = vi.fn().mockResolvedValue({ default: () => <p>Destino</p> })
  const Page = createPreloadableRoute(loader)
  render(
    <Suspense fallback={<p>Cargando</p>}>
      <Page />
    </Suspense>,
  )
  expect(await screen.findByText('Destino')).toBeInTheDocument()
  expect(loader).toHaveBeenCalledTimes(1)
})
it('no conserva una promesa fallida e intenta de nuevo', async () => {
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error('Sin red'))
    .mockResolvedValueOnce({ default: () => <p>Recuperado</p> })
  const Page = createPreloadableRoute(loader)
  await expect(Page.preload()).rejects.toThrow('Sin red')
  await Page.preload()
  render(
    <Suspense fallback={<p>Cargando</p>}>
      <Page />
    </Suspense>,
  )
  expect(screen.getByText('Recuperado')).toBeInTheDocument()
  expect(loader).toHaveBeenCalledTimes(2)
})
