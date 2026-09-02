import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'

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

export function useTenantFiscalSettings() {
  const [settings, setSettings] = useState<FiscalSettings>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tenant_fiscal_settings')
      .select('rfc, legal_name, regimen_fiscal, postal_code')
      .single()
    if (error) {
      reportError('No se pudieron cargar los datos fiscales', error)
    } else {
      setSettings({
        rfc: data.rfc ?? '',
        legalName: data.legal_name ?? '',
        regimenFiscal: data.regimen_fiscal ?? '',
        postalCode: data.postal_code ?? '',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Vacío (string) se guarda como null -- así "completo" se puede checar
  // en SQL con "is not null" en vez de distinguir '' de un valor real.
  const updateSettings = useCallback(
    async (values: FiscalSettings) => {
      const { error } = await supabase
        .from('tenant_fiscal_settings')
        .update({
          rfc: values.rfc.trim() || null,
          legal_name: values.legalName.trim() || null,
          regimen_fiscal: values.regimenFiscal.trim() || null,
          postal_code: values.postalCode.trim() || null,
        })
        .eq('id', 1)
      if (error) {
        reportError('No se pudieron guardar los datos fiscales', error)
        return false
      }
      toast.success('Datos fiscales actualizados')
      await refresh()
      return true
    },
    [refresh],
  )

  const isComplete = Boolean(
    settings.rfc && settings.legalName && settings.regimenFiscal && settings.postalCode,
  )

  return { settings, loading, isComplete, updateSettings }
}
