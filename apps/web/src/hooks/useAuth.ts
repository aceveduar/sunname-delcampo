import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/errors'
import type { Database } from '../lib/database.types'

const PROFILE_FETCH_RETRIES = 2
const PROFILE_FETCH_RETRY_DELAY_MS = 500

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type Profile = Database['public']['Tables']['profiles']['Row']

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // De quién es el `profile` que tenemos guardado ahora mismo (o null si
  // ya sabemos que no hay ninguno). Comparar esto contra el usuario de la
  // sesión actual, en vez de una bandera "profileLoading" separada, evita
  // el hueco de un render entre "la sesión ya llegó" y "el efecto que
  // pide el perfil todavía no corrió" -- ese hueco es justo lo que
  // dejaba a un owner rebotando de /reportes o /usuarios a /caja: por un
  // instante `loading` daba false con profile todavía en null.
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileOwnerId(null)
      return
    }

    let cancelled = false

    // Un hipo de red o un cold-start de Supabase es indistinguible de "el
    // usuario de verdad no tiene perfil" si al primer error nos rendimos
    // -- y rendirse aquí no es un simple mensaje de error: degrada en
    // silencio al mismo estado que un usuario sin rol confirmado (nombre
    // por correo, solo los módulos que no piden admin). Antes esto se
    // quedaba así el resto de la sesión, sin aviso, hasta que alguien
    // recargaba la página a mano. Un par de reintentos resuelve el caso
    // común solo; si de verdad falla, reportError avisa a la persona (no
    // solo a Sentry) -- justo el tipo de fallo silencioso que de verdad
    // duele, mismo criterio que abrir/cerrar caja y registrar una venta.
    async function loadProfile() {
      let lastError: unknown = null
      for (let attempt = 0; attempt <= PROFILE_FETCH_RETRIES; attempt++) {
        if (attempt > 0) await wait(PROFILE_FETCH_RETRY_DELAY_MS * attempt)
        if (cancelled) return

        // El guard de arriba ya descartó null, pero TS no propaga ese
        // estrechamiento hacia una función anidada como loadProfile.
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId as string)
          .single()

        if (cancelled) return
        if (!error) {
          setProfile(data)
          setProfileOwnerId(userId)
          return
        }
        lastError = error
      }

      reportError('No se pudo cargar tu perfil', lastError)
      setProfile(null)
      setProfileOwnerId(userId)
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [userId])

  const profileSettled = profileOwnerId === userId
  const loading = sessionLoading || (userId !== null && !profileSettled)

  const toggleLargeText = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ large_text_mode: !profile.large_text_mode })
      .eq('id', profile.id)
      .select()
      .single()
    if (error) {
      reportError('No se pudo cambiar el tamaño de letra', error)
      return
    }
    setProfile(data)
  }, [profile])

  return { session, profile, loading, toggleLargeText }
}
