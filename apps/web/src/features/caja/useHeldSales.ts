import { useCallback, useEffect, useRef, useState } from 'react'
import { HELD_SALES_CHANGED, readHeldSales } from './heldSaleStorage'
import { heldSalesKey } from './heldSales'
function read(userId: string) {
  try {
    return { sales: readHeldSales(userId).sales, error: null as string | null }
  } catch {
    return {
      sales: [],
      error:
        'No se pudieron leer las ventas en espera. Revisa el almacenamiento de este navegador.',
    }
  }
}
export function useHeldSales(userId: string) {
  const [state, setState] = useState(() => read(userId))
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const refresh = useCallback(() => setState(read(userId)), [userId])
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === heldSalesKey(userId) || event.key === null) refresh()
    }
    window.addEventListener('storage', storage)
    window.addEventListener(HELD_SALES_CHANGED, refresh)
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener(HELD_SALES_CHANGED, refresh)
    }
  }, [userId, refresh])
  const run = async (operation: () => Promise<void>) => {
    if (busyRef.current)
      throw new Error('Espera a que termine la operación actual.')
    busyRef.current = true
    setBusy(true)
    try {
      await operation()
    } finally {
      busyRef.current = false
      setBusy(false)
      refresh()
    }
  }
  return { ...state, busy, busyRef, run, refresh }
}
