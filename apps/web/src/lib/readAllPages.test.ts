import { expect, it, vi } from 'vitest'
import { readAllPages } from './readAllPages'
it('incluye todas las páginas aunque el servidor entregue menos filas por petición', async () => {
  const rows = Array.from({ length: 1003 }, (_, id) => ({ id }))
  const read = vi.fn(async (from: number) => ({
    data: rows.slice(from, from + 200),
    error: null,
    count: rows.length,
  }))
  expect(await readAllPages(read)).toEqual(rows)
  expect(read).toHaveBeenCalledTimes(6)
  expect(read).toHaveBeenLastCalledWith(1000, 1499)
})
it('no presenta un total parcial si falla una página o falta el conteo', async () => {
  const failure = new Error('Sin conexión')
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: [1], error: null, count: 2 })
    .mockResolvedValueOnce({ data: null, error: failure, count: null })
  await expect(readAllPages(read)).rejects.toBe(failure)
  await expect(
    readAllPages(async () => ({ data: [], error: null, count: null })),
  ).rejects.toThrow('incompleta')
})
