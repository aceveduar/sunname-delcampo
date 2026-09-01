import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import type { Database } from '../../lib/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
type Role = Database['public']['Enums']['user_role']

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) {
      reportError('No se pudo cargar el equipo', error)
    } else {
      setProfiles(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateRole = useCallback(
    async (id: string, role: Role) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) {
        reportError('No se pudo cambiar el rol', error)
        return false
      }
      toast.success('Rol actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const updateFullName = useCallback(
    async (id: string, fullName: string) => {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', id)
      if (error) {
        reportError('No se pudo actualizar el nombre', error)
        return false
      }
      toast.success('Nombre actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    async (profile: Profile) => {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !profile.active })
        .eq('id', profile.id)
      if (error) {
        reportError('No se pudo actualizar el estado', error)
        return false
      }
      toast.success(profile.active ? 'Usuario desactivado' : 'Usuario activado')
      await refresh()
      return true
    },
    [refresh],
  )

  return { profiles, loading, refresh, updateRole, updateFullName, toggleActive }
}
