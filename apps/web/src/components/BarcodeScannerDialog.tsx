import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import {
  ChecksumException,
  FormatException,
  NotFoundException,
} from '@zxing/library'
import { Button } from '@/components/ui/button'

/** Lector de código de barras con la cámara del celular. Se usa la
 * librería ZXing (decodificación por software sobre el video, no la
 * API nativa BarcodeDetector) a propósito: BarcodeDetector solo existe
 * en Chrome/Android hoy -- el plan es escalar a iPhone, y ahí no
 * existe, así que un lector nativo habría que reescribirlo después.
 *
 * getUserMedia + video.play() se manejan a mano en vez de usar
 * `decodeFromConstraints` de la librería: esa función envuelve el
 * play() en su propio reintento con timeout de 5s y traga el motivo
 * real del fallo (solo hace console.warn) -- en pruebas reales en un
 * teléfono con permiso ya concedido, eso dejaba la pantalla en blanco
 * sin ninguna pista de qué paso fallaba. Aquí cada paso (permiso,
 * reproducir el video) reporta su propio error si falla.
 *
 * Pantalla completa (portal a document.body, no el Dialog compartido):
 * el Dialog centrado anima con transform/scale al abrir, y un <video>
 * de cámara dentro de un ancestro con CSS transform es un patrón con
 * problemas conocidos de composición en algunos Chrome/WebView de
 * Android -- de paso, pantalla completa es más fácil para apuntar el
 * código que un cuadro chico centrado. */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)

  // onDetected/onOpenChange llegan como funciones nuevas en cada render
  // del padre (ProductsTab) -- si entraran a las dependencias del
  // efecto de abajo, cualquier re-render mientras el diálogo está
  // abierto reiniciaría la cámara a medio prender. Se leen por ref
  // para que el efecto solo dependa de `open`.
  const onDetectedRef = useRef(onDetected)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    onDetectedRef.current = onDetected
    onOpenChangeRef.current = onOpenChange
  })

  useEffect(() => {
    if (!open) return
    setError(null)
    setStreaming(false)
    let cancelled = false

    const start = async () => {
      let stream: MediaStream
      try {
        // Resolución de baja calidad (el default sin pedir nada más
        // suele rondar 640x480 en Android) deja las barras del código
        // con muy pocos píxeles de ancho y el decodificador no logra
        // distinguirlas -- pedir una resolución más alta es lo que de
        // verdad hace la diferencia para leer un código de cerca.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })
      } catch (err) {
        if (!cancelled) {
          const reason = err instanceof Error ? err.name : String(err)
          setError(
            `No se pudo acceder a la cámara (${reason}). Revisa el permiso de cámara del sitio en Chrome.`,
          )
        }
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      // Enfoque continuo es una extensión de Chrome en Android, no
      // parte del estándar -- no todos los teléfonos la soportan, así
      // que un fallo aquí se ignora en silencio y se sigue con el
      // enfoque que haya dado la cámara por default.
      const [track] = stream.getVideoTracks()
      try {
        await track?.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        })
      } catch {
        // sin soporte de enfoque continuo -- no es un error real
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream

      try {
        await video.play()
      } catch (err) {
        if (!cancelled) {
          const reason = err instanceof Error ? err.name : String(err)
          setError(
            `La cámara se activó pero el video no se pudo mostrar (${reason}).`,
          )
        }
        return
      }

      if (cancelled) return
      setStreaming(true)

      const reader = new BrowserMultiFormatReader()
      controlsRef.current = reader.scan(video, (result, decodeError, controls) => {
        if (cancelled) return
        if (result) {
          controls.stop()
          onDetectedRef.current(result.getText())
          onOpenChangeRef.current(false)
          return
        }
        // NotFound/Checksum/Format solo significan "este cuadro no
        // traía un código legible" -- normal en casi todos los cuadros
        // mientras se apunta. Cualquier otro error sí detiene el ciclo
        // de escaneo del lado de la librería (scan() no vuelve a
        // intentar), y sin esto se quedaba la cámara prendida para
        // siempre sin decir por qué ya no iba a capturar nada.
        const isScanMiss =
          decodeError instanceof NotFoundException ||
          decodeError instanceof ChecksumException ||
          decodeError instanceof FormatException
        if (!isScanMiss) {
          setError(
            `El lector se detuvo (${decodeError instanceof Error ? decodeError.message : String(decodeError)}). Cierra y vuelve a abrir para intentar de nuevo.`,
          )
        }
      })
    }

    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChangeRef.current(false)
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3">
        <p className="text-sm font-medium text-white">
          Escanear código de barras
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
        />
        {!error && (
          <div className="border-brand-gold pointer-events-none absolute inset-x-10 top-1/2 h-20 -translate-y-1/2 rounded-md border-2" />
        )}
        {error && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg bg-black/80 p-4 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <p className="p-4 text-center text-xs text-white/70">
        {error
          ? ''
          : streaming
            ? 'Apunta la cámara al código de barras. Se llena solo en cuanto lo reconoce.'
            : 'Activando la cámara…'}
      </p>
    </div>,
    document.body,
  )
}
