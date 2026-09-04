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

  useEffect(() => {
    if (!open) return
    setError(null)
    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result, _err, controls) => {
          if (cancelled || !result) return
          controls.stop()
          onDetected(result.getText())
          onOpenChange(false)
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
            'No se pudo acceder a la cámara. Revisa que el navegador tenga permiso para usarla.',
          )
        }
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, onDetected, onOpenChange])

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
                className="aspect-square w-full object-cover"
                muted
                playsInline
              />
              <div className="border-brand-gold pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-md border-2" />
            </div>
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
