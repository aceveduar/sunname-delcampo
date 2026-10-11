import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { useAsyncResource } from '@/lib/useAsyncResource'

export type FiscalSettings = {
  rfc: string
  legalName: string
  regimenFiscal: string
  postalCode: string
}
const EMPTY: FiscalSettings = {
  rfc: '',
  legalName: '',
  regimenFiscal: '',
  postalCode: '',
}
const COLUMNS = 'rfc, legal_name, regimen_fiscal, postal_code' as const
const fetchSettings = () =>
  supabase.from('tenant_fiscal_settings').select(COLUMNS).single()

export function useTenantFiscalSettings() {
  const { data, setData, loading, error, refresh } = useAsyncResource<{
    rfc: string | null
    legal_name: string | null
    regimen_fiscal: string | null
    postal_code: string | null
  } | null>(fetchSettings, 'No se pudieron cargar los datos fiscales', null)
  const settings: FiscalSettings = data
    ? {
        rfc: data.rfc ?? '',
        legalName: data.legal_name ?? '',
        regimenFiscal: data.regimen_fiscal ?? '',
        postalCode: data.postal_code ?? '',
      }
    : EMPTY
  const ready = data !== null && !loading && !error
  const updateSettings = useCallback(
    async (values: FiscalSettings) => {
      if (!ready) return false
      const { data: saved, error: saveError } = await supabase
        .from('tenant_fiscal_settings')
        .update({
          rfc: values.rfc.trim() || null,
          legal_name: values.legalName.trim() || null,
          regimen_fiscal: values.regimenFiscal.trim() || null,
          postal_code: values.postalCode.trim() || null,
        })
        .eq('id', 1)
        .select(COLUMNS)
        .single()
      if (saveError || !saved) {
        reportError(
          'No se pudieron guardar los datos fiscales',
          saveError ?? new Error('Respuesta sin datos'),
        )
        return false
      }
      setData(saved)
      toast.success('Datos fiscales actualizados')
      return true
    },
    [ready, setData],
  )
  const isComplete =
    ready &&
    Boolean(
      settings.rfc &&
      settings.legalName &&
      settings.regimenFiscal &&
      settings.postalCode,
    )
  return {
    settings,
    loading,
    error,
    refresh,
    ready,
    isComplete,
    updateSettings,
  }
}
