import { createElement, lazy, type ComponentType } from 'react'

/** Una precarga completada evita suspender de nuevo al entrar en la ruta. */
export function createPreloadableRoute<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
) {
  let loaded: ComponentType<P> | null = null
  let pending: ReturnType<typeof loader> | null = null
  const preload = () => {
    if (!pending)
      pending = loader().then(
        (module) => {
          loaded = module.default
          return module
        },
        (error: unknown) => {
          pending = null
          Deferred = lazy(preload)
          throw error
        },
      )
    return pending
  }
  let Deferred = lazy(preload)
  const Page = (props: P) => createElement(loaded ?? Deferred, props)
  return Object.assign(Page, { preload })
}
