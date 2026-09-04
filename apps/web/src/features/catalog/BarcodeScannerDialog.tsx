import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Lector de código de barras con la cámara del celular. Se usa la
 * librería ZXing (decodificación por software sobre el video, no la
 * API nativa BarcodeDetector) a propósito: BarcodeDetector solo existe
 * en Chrome/Android hoy -- el plan es escalar a iPhone, y ahí no
 * existe, así que un lector nativo habría que reescribirlo después. */
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
  const [error, setError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [slow, setSlow] = useState(false)

  // onDetected/onOpenChange llegan como funciones nuevas en cada render
  // del padre (ProductsTab) -- si entraran a las dependencias del efecto
  // de abajo, cualquier re-render mientras el diálogo está abierto
  // reiniciaría la cámara a medio prender, dejando la vista en blanco
  // sin ningún error visible. Se leen por ref para que el efecto solo
  // dependa de `open`.
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open) return
    setError(null)
    setStreaming(false)
    setSlow(false)
    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    // Si a los 5s no hay ni imagen ni error, lo más probable es que el
    // navegador esté esperando una decisión de permiso que no se ve en
    // pantalla (o ya lo bloqueó antes en silencio) -- sin esta pista, la
    // pantalla se queda en blanco para siempre sin explicar por qué.
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, 5000)

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result, _err, controls) => {
          if (cancelled || !result) return
          controls.stop()
          onDetectedRef.current(result.getText())
          onOpenChangeRef.current(false)
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop()
        } else {
          controlsRef.current = controls
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'No se pudo acceder a la cámara. Revisa el permiso de cámara del sitio en Chrome (icono de candado junto a la dirección) y vuelve a intentar.',
          )
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <div className="border-border bg-muted relative overflow-hidden rounded-lg border">
              <video
                ref={videoRef}
                onPlaying={() => setStreaming(true)}
                className="aspect-square w-full object-cover"
                muted
                playsInline
              />
              <div className="border-brand-gold pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-md border-2" />
            </div>
          )}
          {!error && !streaming && slow && (
            <p className="text-destructive text-sm">
              La cámara está tardando en aparecer. Es probable que Chrome ya
              tenga bloqueado el permiso de cámara para este sitio: toca el
              icono de candado junto a la dirección, activa "Cámara" y
              vuelve a abrir este diálogo.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Apunta la cámara al código de barras del producto. Se llena solo
            en cuanto lo reconoce.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
