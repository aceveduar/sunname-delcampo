import { draftKey, parseDraft, type CartDraft } from './cartDraft'
import {
  heldSalesKey,
  parseHeldSales,
  HELD_SALES_LIMIT,
  type HeldSale,
  type HeldSalesStore,
} from './heldSales'

export const HELD_SALES_CHANGED = 'sunname:held-sales-changed'
type Transfer = {
  kind: 'held-sale-transfer'
  id: string
  before: CartDraft | null
  after: CartDraft | null
}

export function readHeldSales(userId: string) {
  return parseHeldSales(localStorage.getItem(heldSalesKey(userId)))
}
/** A commit marker resolves a reload between sessionStorage and localStorage writes. */
export function readCartDraft(userId: string): CartDraft | null {
  const raw = sessionStorage.getItem(draftKey(userId))
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (
    value &&
    typeof value === 'object' &&
    'kind' in value &&
    value.kind === 'held-sale-transfer'
  ) {
    const transfer = value as Transfer
    if (typeof transfer.id !== 'string')
      throw new Error('Respaldo de transferencia inválido')
    const draft = readHeldSales(userId).commits.includes(transfer.id)
      ? transfer.after
      : transfer.before
    if (draft === null) return null
    const parsed = parseDraft(JSON.stringify(draft))
    if (!parsed) throw new Error('Respaldo de venta inválido')
    return parsed
  }
  return parseDraft(raw)
}

function persistDraft(key: string, draft: CartDraft | null) {
  if (draft) sessionStorage.setItem(key, JSON.stringify(draft))
  else sessionStorage.removeItem(key)
}
async function changeStore<T>(
  userId: string,
  change: (store: HeldSalesStore) => T,
) {
  if (!navigator.locks)
    throw new Error(
      'Usa un navegador actualizado para gestionar ventas en espera.',
    )
  return navigator.locks.request(heldSalesKey(userId), () => {
    try {
      return change(readHeldSales(userId))
    } finally {
      window.dispatchEvent(new Event(HELD_SALES_CHANGED))
    }
  })
}
function transfer(
  userId: string,
  store: HeldSalesStore,
  sales: HeldSale[],
  after: CartDraft | null,
) {
  const key = draftKey(userId)
  const storeKey = heldSalesKey(userId)
  const id = crypto.randomUUID()
  const before = readCartDraft(userId)
  const marker: Transfer = { kind: 'held-sale-transfer', id, before, after }
  // Keep the source recoverable until the single localStorage commit succeeds.
  sessionStorage.setItem(key, JSON.stringify(marker))
  try {
    localStorage.setItem(
      storeKey,
      JSON.stringify({ ...store, sales, commits: [...store.commits, id] }),
    )
  } catch (cause) {
    try {
      persistDraft(key, before)
    } catch {
      /* Uncommitted marker recovers "before". */
    }
    throw cause
  }
  try {
    persistDraft(key, after)
    localStorage.setItem(storeKey, JSON.stringify({ ...store, sales }))
  } catch {
    /* Committed marker recovers "after"; an unused commit is harmless. */
  }
}
export function parkSale(userId: string, sale: HeldSale, guard: () => void) {
  return changeStore(userId, (store) => {
    guard()
    if (store.sales.length >= HELD_SALES_LIMIT)
      throw new Error(
        'Hay 20 ventas en espera. Retoma o descarta una antes de guardar otra.',
      )
    transfer(userId, store, [sale, ...store.sales], null)
  })
}
export function takeHeldSale(
  userId: string,
  id: string,
  draft: CartDraft,
  guard: () => void,
) {
  return changeStore(userId, (store) => {
    guard()
    if (!store.sales.some((sale) => sale.id === id))
      throw new Error('Esta venta ya se retomó o descartó en otra pestaña.')
    transfer(
      userId,
      store,
      store.sales.filter((sale) => sale.id !== id),
      draft,
    )
  })
}
export function discardHeldSale(userId: string, id: string) {
  return changeStore(userId, (store) => {
    localStorage.setItem(
      heldSalesKey(userId),
      JSON.stringify({
        ...store,
        sales: store.sales.filter((sale) => sale.id !== id),
      }),
    )
  })
}
