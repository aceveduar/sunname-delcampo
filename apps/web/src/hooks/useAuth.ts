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
      console.log('[diag] getSession resolved', { hasSession: !!data.session })
      setSession(data.session)
      setSessionLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[diag] onAuthStateChange', event, { hasSession: !!newSession })
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    console.log('[diag] profile effect run', { hasSession: !!session })
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
        console.log('[diag] profile fetch resolved', { cancelled, hasData: !!data, role: data?.role, error: error?.message })
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
