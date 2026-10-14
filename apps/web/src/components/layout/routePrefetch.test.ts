import { afterEach, expect, it, vi } from 'vitest'
import { canPrefetchRoute, prefetchRoute } from './routePrefetch'
const loaded = vi.hoisted(() => vi.fn())
vi.mock('@/features/inventory/InventoryPage', () => {
  loaded()
  return { InventoryPage: () => null }
})
afterEach(() => vi.unstubAllGlobals())
it('reutiliza la descarga y no carga destinos desconocidos', async () => {
  const a = prefetchRoute('/inventario')
  const b = prefetchRoute('/inventario')
  expect(a).toBe(b)
  await a
  expect(loaded).toHaveBeenCalledTimes(1)
  await prefetchRoute('/desconocido')
  expect(loaded).toHaveBeenCalledTimes(1)
})
it.each([
  [false, undefined, false],
  [true, undefined, true],
  [true, { saveData: true }, false],
  [true, { effectiveType: '2g' }, false],
  [true, { effectiveType: '3g' }, false],
  [true, { effectiveType: '4g' }, true],
])('conectividad %s %o permite %s', (onLine, connection, allowed) => {
  vi.stubGlobal('navigator', { onLine, connection })
  expect(canPrefetchRoute()).toBe(allowed)
})
