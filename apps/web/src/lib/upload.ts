// Sin esto, una subida a Storage con señal débil o sin datos móviles se
// queda colgada en silencio -- el navegador no tiene un límite propio de
// tiempo para fetch, así que "Subiendo…" se podía quedar así indefinidamente
// sin ningún error que explicara que era la conexión.

const TIMEOUT_MS = 20_000

/** Envuelve una subida a Storage: si el navegador ya sabe que no hay
 * conexión, falla de inmediato; si hay señal pero no respuesta, corta a
 * los 20s en vez de esperar lo que el navegador tarde en darse por
 * vencido. La subida real sigue en segundo plano si llega a completarse
 * tarde, pero la UI ya no se queda esperando. */
export function withUploadTimeout<T extends { error: unknown }>(
  upload: Promise<T>,
): Promise<T> {
  if (!navigator.onLine) {
    return Promise.resolve({
      error: new Error('Sin conexión a internet -- revisa tu señal e intenta de nuevo'),
    } as T)
  }

  return Promise.race([
    upload,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        resolve({
          error: new Error(
            'La subida está tardando demasiado -- revisa tu conexión a internet e intenta de nuevo',
          ),
        } as T)
      }, TIMEOUT_MS)
    }),
  ])
}
