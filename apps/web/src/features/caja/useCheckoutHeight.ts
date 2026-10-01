import { useLayoutEffect, useRef } from 'react'

/** Descuenta el encabezado real, incluso si cambia por zoom o avisos. */
export function useCheckoutHeight() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const measure = () => {
      const top = Math.max(12, element.getBoundingClientRect().top)
      const height = Math.max(320, window.innerHeight - top - 12)
      element.style.setProperty('--sale-panel-height', `${height}px`)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    const container = element.parentElement?.parentElement
    if (container) observer.observe(container)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
    }
  }, [])
  return ref
}
