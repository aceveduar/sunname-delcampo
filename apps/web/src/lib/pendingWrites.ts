import { useSyncExternalStore } from 'react'

let count = 0
const listeners = new Set<() => void>()
function notify() {
  for (const listener of listeners) listener()
}
/** Sigue las escrituras HTTP en vuelo, incluidas RPC y subida de archivos. */
export const trackedFetch: typeof fetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase()
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (writing) {
    count++
    notify()
  }
  try {
    return await fetch(input, init)
  } finally {
    if (writing) {
      count--
      notify()
    }
  }
}
export function usePendingWrites() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => count,
    () => 0,
  )
}
