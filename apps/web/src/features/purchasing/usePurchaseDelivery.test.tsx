import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePurchaseDelivery } from './usePurchaseDelivery'
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
const input = { items: [{ item_id: 'line', quantity: 7 }], notes: 'Entrega' }
beforeEach(() => {
  sessionStorage.clear()
  rpc.mockReset()
})
afterEach(cleanup)
it('recupera la entrega tras recargar y reintenta sin cambiar UUID ni cantidades', async () => {
  rpc.mockRejectedValueOnce(new Error('network'))
  const first = renderHook(() => usePurchaseDelivery('order', 'user'))
  await act(async () => {
    expect(await first.result.current.submit(input)).toBe(false)
  })
  const request = rpc.mock.calls[0][1]
  first.unmount()
  const second = renderHook(() => usePurchaseDelivery('order', 'user'))
  expect(second.result.current.pending?.id).toBe(request.p_client_uuid)
  rpc.mockResolvedValueOnce({ data: 'receipt', error: null })
  await act(async () => {
    expect(await second.result.current.submit({ items: [], notes: '' })).toBe(
      true,
    )
  })
  expect(rpc.mock.calls[1][1]).toEqual(request)
  expect(sessionStorage.length).toBe(0)
})
it('permite corregir después de rechazo y no comparte borradores entre usuarios', async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { code: 'P0001', message: 'Cantidad supera pendiente' },
  })
  const { result } = renderHook(() => usePurchaseDelivery('order', 'user'))
  await act(async () => {
    await result.current.submit(input)
  })
  expect(result.current.pending).toBeNull()
  expect(result.current.error).toBe('Cantidad supera pendiente')
  rpc.mockRejectedValueOnce(new Error('network'))
  await act(async () => {
    await result.current.submit(input)
  })
  expect(
    renderHook(() => usePurchaseDelivery('order', 'other')).result.current
      .pending,
  ).toBeNull()
})
