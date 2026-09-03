import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { compressImage } from '../../lib/image'

// Lo que devuelve la función extract-price-sheet. Se declara a mano (no
// sale de database.types.ts) porque es la respuesta de una edge function,
// no una tabla.

export type PriceSheetRenglon = {
  indice: number
  descripcion: string | null
  precio_100g: number | null
  precio_cuarto: number | null
  precio_kilo: number | null
  ilegible: boolean
  /** El kilo no se leyó, se derivó del cuarto (cuarto x 4). */
  kilo_deducido: boolean
  /** El cuarto leído coincide con kilo/4. null = no se pudo comprobar. */
  cuarto_cuadra: boolean | null
  requiere_revision: boolean
}

export type PriceSheetLectura = {
  extraccion: {
    hoja: { titulo: string | null; fecha: string | null }
    notas: string | null
  }
  modelo: string
  verificacion: {
    renglones: PriceSheetRenglon[]
    renglones_por_revisar: number
    sin_precio_legible: number
  }
  /** Dónde quedó la foto, para poder volver al papel original. */
  storagePath: string
}

const BUCKET = 'price-sheets'

export function usePriceSheetCapture() {
  const [analyzing, setAnalyzing] = useState(false)

  const analyze = useCallback(async (file: File): Promise<PriceSheetLectura | null> => {
    setAnalyzing(true)
    try {
      // Comprimir no es opcional: una foto cruda de celular tumba la
      // función por límite de recursos antes de llegar al modelo. 1600px
      // conserva la letra manuscrita, que es lo más difícil de leer aquí.
      const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.8 })

      const storagePath = `${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, compressed, { contentType: compressed.type })

      if (uploadError) {
        reportError('No se pudo subir la foto de la hoja', uploadError)
        return null
      }

      const { data, error } = await supabase.functions.invoke('extract-price-sheet', {
        body: { storage_path: storagePath },
      })

      if (error) {
        // La función responde un mensaje propio en el cuerpo; el SDK solo
        // deja ver "non-2xx status code", que no le dice nada al usuario.
        let message = 'No se pudo leer la hoja de precios'
        try {
          const body = await error.context?.json()
          if (body?.message) message = body.message
        } catch {
          // Sin cuerpo legible -- se queda el mensaje genérico.
        }
        reportError(message, error)
        return null
      }

      return { ...(data as Omit<PriceSheetLectura, 'storagePath'>), storagePath }
    } finally {
      setAnalyzing(false)
    }
  }, [])

  return { analyzing, analyze }
}
