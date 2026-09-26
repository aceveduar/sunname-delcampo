import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCashMovement } from './useCashMovement'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))
const input = { direction: 'out' as const, amount: 25, reason: 'Bolsas' }
beforeEach(() => {
  sessionStorage.clear()
  rpc.mockReset()
})
afterEach(cleanup)

it('recupera una solicitud incierta y reintenta el mismo UUID sin cambiar los datos', async () => {
  rpc.mockRejectedValueOnce(new Error('network'))
  const first = renderHook(() => useCashMovement('session', 'user'))
  await act(async () => {
    expect(await first.result.current.submit(input)).toBe(false)
  })
  const request = rpc.mock.calls[0][1]
  expect(first.result.current.pending?.amount).toBe(25)
  first.unmount()
  const recovered = renderHook(() => useCashMovement('session', 'user'))
  expect(recovered.result.current.pending?.id).toBe(request.p_client_uuid)
  rpc.mockResolvedValueOnce({ data: 'saved', error: null })
  await act(async () => {
    expect(
      await recovered.result.current.submit({ ...input, amount: 99 }),
    ).toBe(true)
  })
  expect(rpc.mock.calls[1][1]).toEqual(request)
  expect(recovered.result.current.pending).toBeNull()
  expect(sessionStorage.length).toBe(0)
})

it('separa las solicitudes por usuario y caja', async () => {
  rpc.mockRejectedValueOnce(new Error('network'))
  const first = renderHook(() => useCashMovement('session', 'user'))
  await act(async () => {
    await first.result.current.submit(input)
  })
  expect(
    renderHook(() => useCashMovement('session', 'other')).result.current
      .pending,
  ).toBeNull()
  expect(
    renderHook(() => useCashMovement('other', 'user')).result.current.pending,
  ).toBeNull()
})

it('permite corregir el importe después de un rechazo confirmado del servidor', async () => {
  rpc.mockResolvedValueOnce({
    data: null,
    error: { code: 'P0001', message: 'Saldo insuficiente' },
  })
  const { result } = renderHook(() => useCashMovement('session', 'user'))
  await act(async () => {
    expect(await result.current.submit(input)).toBe(false)
  })
  expect(result.current.pending).toBeNull()
  expect(result.current.error).toBe('Saldo insuficiente')
  expect(sessionStorage.length).toBe(0)
})

it('no envía una operación si no puede persistir su identificador de reintento', async () => {
  const storage = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('quota')
    })
  try {
    const { result } = renderHook(() => useCashMovement('session', 'user'))
    await act(async () => {
      expect(await result.current.submit(input)).toBe(false)
    })
    expect(rpc).not.toHaveBeenCalled()
  } finally {
    storage.mockRestore()
  }
})

it('ignora un segundo envío mientras el primero está en curso', async () => {
  let resolve!: (value: unknown) => void
  rpc.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    }),
  )
  const { result } = renderHook(() => useCashMovement('session', 'user'))
  await act(async () => {
    const first = result.current.submit(input)
    expect(await result.current.submit(input)).toBe(false)
    resolve({ data: 'saved', error: null })
    await first
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})
