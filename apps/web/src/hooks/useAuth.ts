import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { reportError } from '../lib/errors'
import type { Database } from '../lib/database.types'

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
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('No se pudo cargar el perfil:', error)
        setProfile(data)
        setProfileOwnerId(userId)
      })

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
