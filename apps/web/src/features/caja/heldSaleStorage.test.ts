import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDraft, draftKey } from './cartDraft'
import { createHeldSale, heldSalesKey } from './heldSales'
import {
  parkSale,
  takeHeldSale,
  readHeldSales,
  readCartDraft,
} from './heldSaleStorage'
import type { Product } from '@/features/catalog/useProducts'

const product = {
  id: 'p1',
  name: 'Frijoles',
  unit_id: 'pza',
  price: 20,
  price_per_100g: null,
  active: true,
  sold_by_weight: false,
} as Product
const lines = [{ product, quantity: 2 }]
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  let queue = Promise.resolve()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, action: () => unknown) => {
        const result = queue.then(action)
        queue = result.then(
          () => undefined,
          () => undefined,
        )
        return result
      },
    },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks)
  else Reflect.deleteProperty(navigator, 'locks')
})
function sale() {
  return createHeldSale(lines, 'session', 'customer', 'Ana', 'Bolsa azul')
}
function saveCurrent() {
  sessionStorage.setItem(
    draftKey('user'),
    JSON.stringify(createDraft(lines, 'session', null, 'customer')),
  )
}

it('guarda por usuario, conserva el cliente y permite retomar en una nueva caja sin cobrar', async () => {
  saveCurrent()
  const held = sale()
  await parkSale('user', held, () => {})
  expect(readCartDraft('user')).toBeNull()
  expect(readHeldSales('other').sales).toEqual([])
  expect(readHeldSales('user').sales[0].draft.customerId).toBe('customer')
  await takeHeldSale(
    'user',
    held.id,
    createDraft(lines, 'new-session', null, 'customer'),
    () => {},
  )
  expect(readHeldSales('user').sales).toEqual([])
  expect(readCartDraft('user')).toMatchObject({
    sessionId: 'new-session',
    customerId: 'customer',
    checkoutId: null,
  })
})
it('solo una pestaña puede retomar la misma venta', async () => {
  const held = sale()
  await parkSale('user', held, () => {})
  const outcomes = await Promise.allSettled([
    takeHeldSale('user', held.id, held.draft, () => {}),
    takeHeldSale('user', held.id, held.draft, () => {}),
  ])
  expect(outcomes.map((result) => result.status)).toEqual([
    'fulfilled',
    'rejected',
  ])
  expect(readCartDraft('user')?.lines).toHaveLength(1)
})
it('si el almacenamiento se llena, conserva la venta actual y no inventa una pausa', async () => {
  saveCurrent()
  const before = sessionStorage.getItem(draftKey('user'))
  const write = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (this === localStorage)
      throw new DOMException('Lleno', 'QuotaExceededError')
    write.call(this, key, value)
  })
  await expect(parkSale('user', sale(), () => {})).rejects.toThrow()
  expect(sessionStorage.getItem(draftKey('user'))).toBe(before)
  expect(readHeldSales('user').sales).toEqual([])
})
it('no retira la venta en espera si no puede respaldar el carrito de destino', async () => {
  const held = sale()
  await parkSale('user', held, () => {})
  const write = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (this === sessionStorage) throw new Error('Sin almacenamiento')
    write.call(this, key, value)
  })
  await expect(
    takeHeldSale('user', held.id, held.draft, () => {}),
  ).rejects.toThrow()
  expect(readHeldSales('user').sales).toHaveLength(1)
})
it('recupera la pausa confirmada aunque falle la limpieza de sessionStorage', async () => {
  saveCurrent()
  const remove = Storage.prototype.removeItem
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
    this: Storage,
    key,
  ) {
    if (this === sessionStorage) throw new Error('Interrupción')
    remove.call(this, key)
  })
  await parkSale('user', sale(), () => {})
  expect(JSON.parse(sessionStorage.getItem(draftKey('user'))!).kind).toBe(
    'held-sale-transfer',
  )
  expect(readCartDraft('user')).toBeNull()
  expect(readHeldSales('user').sales).toHaveLength(1)
})
it('recupera la venta retomada si se interrumpe después del commit y antes de limpiar el marcador', async () => {
  const held = sale()
  await parkSale('user', held, () => {})
  const write = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (
      this === sessionStorage &&
      JSON.parse(value).kind !== 'held-sale-transfer'
    )
      throw new Error('Interrupción')
    write.call(this, key, value)
  })
  await takeHeldSale('user', held.id, held.draft, () => {})
  expect(readHeldSales('user').sales).toEqual([])
  expect(readCartDraft('user')).toEqual(held.draft)
})
it('un marcador sin commit recupera la venta anterior; un almacén ilegible no se sobrescribe', async () => {
  const before = createDraft(lines, 'session', null)
  sessionStorage.setItem(
    draftKey('user'),
    JSON.stringify({
      kind: 'held-sale-transfer',
      id: 'uncommitted',
      before,
      after: null,
    }),
  )
  expect(readCartDraft('user')).toEqual(before)
  localStorage.setItem(heldSalesKey('user'), '{broken')
  await expect(parkSale('user', sale(), () => {})).rejects.toThrow()
  expect(localStorage.getItem(heldSalesKey('user'))).toBe('{broken')
})
