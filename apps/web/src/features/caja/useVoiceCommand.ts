import { useCallback, useEffect, useRef, useState } from 'react'
import { Sentry } from '../../lib/sentry'

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

// El reconocimiento de Chrome manda el audio a internet para
// procesarlo -- sin conexión falla con "network", no con "no-speech".
// Antes los dos se veían idénticos ("No se detectó voz, intenta de
// nuevo"), un mensaje engañoso cuando el problema real es la conexión
// del negocio, no que nadie habló. `report` marca los códigos que
// valen la pena en Sentry: "no-speech" es ruido normal (nadie habló a
// tiempo, o el micrófono captó silencio) y "aborted" es un stop a
// propósito (botón, o el componente se desmontó) -- ninguno de los dos
// es una falla real que el equipo necesite saber que ocurrió.
function describeSpeechError(code: string): { message: string | null; report: boolean } {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { message: 'Sin permiso de micrófono -- actívalo en el navegador.', report: false }
    case 'network':
      return {
        message: 'Sin conexión a internet -- el reconocimiento de voz la necesita.',
        report: true,
      }
    case 'audio-capture':
      return { message: 'No se encontró un micrófono disponible.', report: true }
    case 'aborted':
      return { message: null, report: false }
    case 'no-speech':
      return { message: 'No se detectó voz, intenta de nuevo.', report: false }
    default:
      return { message: 'No se detectó voz, intenta de nuevo.', report: true }
  }
}

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
      const { message, report } = describeSpeechError(event.error)
      if (message) setError(message)
      // Sentry directo (no reportError): el aviso al cajero ya sale del
      // estado `error` de arriba -- reportError mostraría un segundo
      // toast duplicado.
      if (report) {
        Sentry.captureException(new Error(`Comando de voz: ${event.error}`), {
          extra: { userMessage: message },
        })
      }
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
