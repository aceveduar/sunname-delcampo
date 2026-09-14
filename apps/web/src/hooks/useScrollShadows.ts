import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

type Axis = 'vertical' | 'horizontal'

/** Sombra de scroll (mismo patrón que usaba components/ui/table.tsx por
 * su cuenta, ahí solo horizontal): avisa cuando hay más contenido sin
 * verse hacia el inicio/final del eje, y desaparece al llegar al borde.
 * Una sola implementación para las dos direcciones que el sistema
 * necesita hoy -- la tabla compartida (horizontal) y el carrito de Caja
 * (vertical) -- en vez de que cada una reimplemente el mismo cálculo de
 * scroll y el mismo ResizeObserver por separado.
 *
 * Dos formas de disparar una re-medición cuando el contenido cambia sin
 * que la caja del propio contenedor cambie (scroll con alto/ancho fijo):
 * - `contentRef`: un elemento adicional a observar cuyo tamaño sí varía
 *   con el contenido (ej. el propio <table>, que crece con sus filas).
 *   Preferible cuando existe: reacciona al tamaño real, no a una señal
 *   manual.
 * - `extraDep`: un solo valor (ej. un conteo) para cuando no hay un
 *   elemento de contenido natural al que ponerle ref (ej. el carrito,
 *   donde las líneas son hermanas directas del contenedor con scroll).
 *   Un solo valor, no una lista de dependencias: cubre el caso real sin
 *   la advertencia de "expresión compleja" que deja un spread en el
 *   arreglo de dependencias de un efecto. */
export function useScrollShadows<T extends HTMLElement>(options?: {
  axis?: Axis
  contentRef?: RefObject<HTMLElement | null>
  extraDep?: unknown
}) {
  const axis = options?.axis ?? 'vertical'
  const contentRef = options?.contentRef
  const extraDep = options?.extraDep
  const ref = useRef<T>(null)
  const [canScrollStart, setCanScrollStart] = useState(false)
  const [canScrollEnd, setCanScrollEnd] = useState(false)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (axis === 'horizontal') {
      setCanScrollStart(el.scrollLeft > 0)
      setCanScrollEnd(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    } else {
      setCanScrollStart(el.scrollTop > 0)
      setCanScrollEnd(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
    }
  }, [axis])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    const content = contentRef?.current
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [update, contentRef, extraDep])

  return { ref, canScrollStart, canScrollEnd, onScroll: update }
}
