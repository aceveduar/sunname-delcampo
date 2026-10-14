import { useCallback, useEffect, useRef } from 'react'
import { NavLink, useLocation, type NavLinkProps } from 'react-router-dom'
import { canPrefetchRoute, prefetchRoute } from './routePrefetch'

/** Anticipa únicamente el destino señalado; evita descargas por cruces rápidos del puntero. */
export function IntentLink({
  to,
  ...props
}: Omit<NavLinkProps, 'to'> & { to: string }) {
  const { pathname } = useLocation()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => cancel, [cancel, to])
  const prepare = () => {
    cancel()
    if (pathname !== to && canPrefetchRoute()) void prefetchRoute(to)
  }
  const schedule = () => {
    cancel()
    if (pathname !== to && canPrefetchRoute())
      timer.current = setTimeout(prepare, 120)
  }
  return (
    <NavLink
      {...props}
      to={to}
      onPointerEnter={(event) => {
        props.onPointerEnter?.(event)
        if (!event.defaultPrevented && event.pointerType !== 'touch') schedule()
      }}
      onPointerLeave={(event) => {
        cancel()
        props.onPointerLeave?.(event)
      }}
      onFocus={(event) => {
        props.onFocus?.(event)
        if (!event.defaultPrevented) schedule()
      }}
      onBlur={(event) => {
        cancel()
        props.onBlur?.(event)
      }}
      onPointerDown={(event) => {
        props.onPointerDown?.(event)
        if (!event.defaultPrevented && event.pointerType === 'touch') prepare()
      }}
    />
  )
}
