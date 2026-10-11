import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { useAsyncResource } from '@/lib/useAsyncResource'

const fetchSettings = () =>
  supabase.from('tenant_settings').select('business_name').single()

export function useTenantSettings() {
  const { data, setData, loading, error, refresh } = useAsyncResource<{
    business_name: string
  } | null>(
    fetchSettings,
    'No se pudo cargar la configuración del negocio',
    null,
  )
  const ready = data !== null && !loading && !error
  const updateBusinessName = useCallback(
    async (name: string) => {
      if (!ready || !name.trim()) return false
      const { data: saved, error: saveError } = await supabase
        .from('tenant_settings')
        .update({ business_name: name.trim() })
        .eq('id', 1)
        .select('business_name')
        .single()
      if (saveError || !saved) {
        reportError(
          'No se pudo guardar el nombre del negocio',
          saveError ?? new Error('Respuesta sin datos'),
        )
        return false
      }
      setData(saved)
      toast.success('Nombre del negocio actualizado')
      return true
    },
    [ready, setData],
  )
  return {
    businessName: data?.business_name ?? '',
    ready,
    loading,
    error,
    refresh,
    updateBusinessName,
  }
}
