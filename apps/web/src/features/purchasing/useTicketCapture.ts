import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { compressImage } from '../../lib/image'

// Lo que la función extract-purchase-ticket regresa. Se declara aquí a
// mano (no sale de database.types.ts) porque es la respuesta de una edge
// function, no una tabla.

export type TicketRenglon = {
  indice: number
  descripcion: string | null
  codigo_proveedor: string | null
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  importe: number | null
  ilegible: boolean
  /** La cantidad no se leyó pero se dedujo de importe / precio unitario. */
  cantidad_deducida: boolean
  /** cantidad x precio coincide con el importe. null = no se pudo comprobar. */
  cuadra: boolean | null
  requiere_revision: boolean
}

export type TicketLectura = {
  extraccion: {
    proveedor: { nombre: string | null; rfc: string | null }
    documento: {
      tipo: string | null
      folio: string | null
      fecha: string | null
      subtotal: number | null
      impuestos: number | null
      total: number | null
    }
    notas: string | null
  }
  modelo: string
  verificacion: {
    renglones: TicketRenglon[]
    suma_renglones: number | null
    total_documento: number | null
    diferencia: number | null
    cuadra: boolean | null
    renglones_por_revisar: number
  }
  /** Dónde quedó la foto en Storage, para poder volver a verla después. */
  storagePath: string
}

const BUCKET = 'purchase-tickets'

export function useTicketCapture() {
  const [analyzing, setAnalyzing] = useState(false)

  const analyze = useCallback(async (file: File): Promise<TicketLectura | null> => {
    setAnalyzing(true)
    try {
      // Comprimir no es opcional aquí: una foto cruda de celular (3MB) tumba
      // la función por límite de recursos del worker antes de llegar a
      // Gemini -- confirmado en pruebas reales. 1600px conserva de sobra la
      // letra chica de un ticket; 1200px (el default de fotos de producto)
      // ya empieza a costar legibilidad en los renglones apretados.
      const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.8 })

      const storagePath = `${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, compressed, { contentType: compressed.type })

      if (uploadError) {
        reportError('No se pudo subir la foto del ticket', uploadError)
        return null
      }

      const { data, error } = await supabase.functions.invoke('extract-purchase-ticket', {
        body: { storage_path: storagePath },
      })

      if (error) {
        // La función responde un mensaje propio en el cuerpo; el SDK solo
        // deja ver "non-2xx status code", que no le dice nada al usuario.
        let message = 'No se pudo leer el ticket'
        try {
          const body = await error.context?.json()
          if (body?.message) message = body.message
        } catch {
          // Sin cuerpo legible -- se queda el mensaje genérico.
        }
        reportError(message, error)
        return null
      }

      return { ...(data as Omit<TicketLectura, 'storagePath'>), storagePath }
    } finally {
      setAnalyzing(false)
    }
  }, [])

  return { analyzing, analyze }
}
