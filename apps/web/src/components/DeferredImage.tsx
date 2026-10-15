import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'

/** No solicita la foto hasta acercarse al área visible, también dentro de paneles con scroll. */
export function DeferredImage({
  src,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading'> & {
  src: string
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [requestedSource, setRequestedSource] = useState<string | null>(null)
  const supported = typeof IntersectionObserver !== 'undefined'
  useEffect(() => {
    const element = ref.current
    if (!element || !supported) return
    let active = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (active && entries.some((entry) => entry.isIntersecting)) {
          setRequestedSource(src)
          observer.disconnect()
        }
      },
      { rootMargin: '160px 0px' },
    )
    observer.observe(element)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [src, supported])
  return (
    <img
      {...props}
      ref={ref}
      src={!supported || requestedSource === src ? src : undefined}
      loading="lazy"
      decoding="async"
    />
  )
}
