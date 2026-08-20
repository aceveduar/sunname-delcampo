import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

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

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('No se pudo cargar el perfil:', error)
        setProfile(data)
        setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  // El "loading" general no puede bajar solo con la sesion resuelta: si hay
  // sesion, hay que esperar tambien el perfil (rol) antes de dejar que las
  // rutas decidan quien es admin -- si no, un refresh en /reportes o
  // /usuarios rebota al admin de vuelta a /caja porque profile todavia es
  // null en el primer render.
  return { session, profile, loading: sessionLoading || profileLoading }
}
