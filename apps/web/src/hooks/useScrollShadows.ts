import { useCallback, useEffect, useRef, useState } from 'react'

/** Sombra de scroll (mismo patrón que components/ui/table.tsx, ahí en
 * horizontal) para un contenedor que se desplaza en vertical -- avisa
 * cuando hay más contenido arriba/abajo sin verse, y desaparece al
 * llegar al final. `extraDep` fuerza una re-medición cuando el
 * contenedor no cambia de tamaño pero su contenido sí (ej. el número de
 * líneas de un carrito con altura máxima fija -- ResizeObserver no lo
 * detecta porque la caja del propio contenedor no cambia). Un solo valor,
 * no una lista de dependencias: cubre el caso real (un conteo) sin la
 * advertencia de "expresión compleja" que deja un spread en el arreglo
 * de dependencias de un efecto. */
export function useScrollShadows<T extends HTMLElement>(extraDep?: unknown) {
  const ref = useRef<T>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update, extraDep])

  return { ref, canScrollUp, canScrollDown, onScroll: update }
}
