import { act, renderHook } from '@testing-library/react'
import { expect, it, vi, beforeEach } from 'vitest'
import { useCreatePurchaseOrder } from './useCreatePurchaseOrder'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('@/lib/errors', () => ({ reportError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
beforeEach(() => rpc.mockReset())
const input = {
  supplierId: 's1',
  notes: null,
  items: [{ productId: 'p1', quantity: 2, unitCost: 30 }],
}
it('reintenta una respuesta incierta con el mismo UUID y no acepta otra compra entre tanto', async () => {
  rpc
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ data: 'order', error: null })
  const { result } = renderHook(() => useCreatePurchaseOrder())
  await act(async () => {
    expect(await result.current(input)).toBe(false)
  })
  const first = rpc.mock.calls[0][1].p_client_uuid
  await act(async () => {
    expect(await result.current({ ...input, notes: 'otra' })).toBe(false)
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  await act(async () => {
    expect(await result.current(input)).toBe(true)
  })
  expect(rpc.mock.calls[1][1].p_client_uuid).toBe(first)
})
it('permite corregir datos tras un rechazo definitivo del servidor', async () => {
  rpc
    .mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Producto no disponible' },
    })
    .mockResolvedValueOnce({ data: 'order', error: null })
  const { result } = renderHook(() => useCreatePurchaseOrder())
  await act(async () => {
    await result.current(input)
  })
  await act(async () => {
    expect(await result.current({ ...input, notes: 'corregido' })).toBe(true)
  })
})

it('no convierte un fallo de refresco en un fallo de creación', async () => {
  rpc.mockResolvedValue({ data: 'order', error: null })
  const onDone = vi.fn().mockRejectedValue(new Error('refresh'))
  const { result } = renderHook(() => useCreatePurchaseOrder(onDone))
  await act(async () => {
    expect(await result.current(input)).toBe(true)
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})
