import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Comparte el criterio de CSS sin escuchar cada evento de resize. */
export function useMediaQuery(query: string) {
  const media = useMemo(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query)
        : null,
    [query],
  )
  const subscribe = useCallback(
    (notify: () => void) => {
      media?.addEventListener('change', notify)
      return () => media?.removeEventListener('change', notify)
    },
    [media],
  )
  const snapshot = useCallback(() => media?.matches ?? true, [media])
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
