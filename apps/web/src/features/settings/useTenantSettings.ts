import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function useTenantSettings() {
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenant_settings')
      .select('business_name')
      .single()
    if (error) {
      toast.error('No se pudo cargar la configuración del negocio', {
        description: error.message,
      })
    } else {
      setBusinessName(data.business_name)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateBusinessName = useCallback(
    async (name: string) => {
      const { error } = await supabase
        .from('tenant_settings')
        .update({ business_name: name })
        .eq('id', 1)
      if (error) {
        toast.error('No se pudo guardar el nombre del negocio', {
          description: error.message,
        })
        return false
      }
      toast.success('Nombre del negocio actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  return { businessName, loading, updateBusinessName }
}
