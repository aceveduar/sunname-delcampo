import { useCallback, useEffect, useRef, useState } from 'react'

// La Web Speech API no trae tipos en lib.dom (solo Chrome/Edge la
// implementan, con prefijo "webkit") -- se declara aquí lo mínimo que
// se usa, en vez de traer una librería de tipos completa para esto.
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Push-to-talk: un tap arranca a escuchar, se detiene solo al primer
 * silencio (o con otro tap) y entrega la transcripción final. Nunca
 * escucha de forma continua -- eso evita que dispare con conversación
 * de fondo que no iba dirigida a la caja. */
export function useVoiceCommand() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  // getSpeechRecognitionCtor() solo lee propiedades de window -- barato,
  // no necesita guardarse en una ref ni recalcularse con cuidado.
  const supported = getSpeechRecognitionCtor() !== null

  const start = useCallback((onFinal: (text: string) => void) => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = 'es-MX'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const text = last[0].transcript
      setTranscript(text)
      if (last.isFinal) onFinal(text)
    }
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Sin permiso de micrófono -- actívalo en el navegador.'
          : 'No se detectó voz, intenta de nuevo.',
      )
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    setError(null)
    setTranscript('')
    setListening(true)
    recognition.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // Si el componente se desmonta a media escucha (ej. el cajero navega a
  // otra pantalla), el micrófono no debe quedarse abierto.
  useEffect(() => () => recognitionRef.current?.stop(), [])

  return { supported, listening, transcript, error, start, stop }
}
