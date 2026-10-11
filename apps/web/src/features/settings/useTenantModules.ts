import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { useAsyncResource } from '@/lib/useAsyncResource'

export type ModuleKey = 'crm' | 'purchasing' | 'billing'

export const MODULE_LABELS: Record<
  ModuleKey,
  { name: string; description: string }
> = {
  crm: {
    name: 'Clientes (CRM)',
    description: 'Registrar clientes y ligarlos a una venta.',
  },
  purchasing: {
    name: 'Compras',
    description: 'Proveedores y órdenes de compra.',
  },
  billing: {
    name: 'Facturación',
    description:
      'Factura global CFDI 4.0 por corte de caja. Requiere completar los datos fiscales del negocio -- el timbrado real con un PAC todavía no está conectado.',
  },
}

// Caja, Catálogo e Inventario son el núcleo del sistema (CLAUDE.md §5.1,
// plan "Básico") -- no se ofrecen como apagables desde aquí, aunque la
// tabla tenant_modules también tenga una fila para ellos.
const fetchModules = () =>
  supabase.from('tenant_modules').select('module_key, enabled')

export function useTenantModules() {
  const {
    data: modules,
    setData,
    loading,
    error,
    refresh,
  } = useAsyncResource<{ module_key: string; enabled: boolean }[] | null>(
    fetchModules,
    'No se pudieron cargar los módulos',
    null,
  )
  const pendingRef = useRef(new Set<ModuleKey>())
  const [saving, setSaving] = useState<ReadonlySet<ModuleKey>>(new Set())
  const [saveErrors, setSaveErrors] = useState<
    Partial<Record<ModuleKey, string>>
  >({})
  const isEnabled = useCallback(
    (key: ModuleKey) =>
      modules?.find((m) => m.module_key === key)?.enabled ?? false,
    [modules],
  )

  const setModuleEnabled = useCallback(
    async (key: ModuleKey, enabled: boolean) => {
      if (!modules || loading || error || pendingRef.current.has(key))
        return false
      pendingRef.current.add(key)
      setSaving(new Set(pendingRef.current))
      setSaveErrors((current) => ({ ...current, [key]: undefined }))
      try {
        const { data, error: saveError } = await supabase
          .from('tenant_modules')
          .update({ enabled })
          .eq('module_key', key)
          .select('module_key, enabled')
          .single()
        if (saveError || !data)
          throw saveError ?? new Error('Respuesta sin datos')
        setData((current) => [
          ...(current ?? []).filter((m) => m.module_key !== key),
          data,
        ])
        toast.success(enabled ? 'Módulo activado' : 'Módulo desactivado')
        return true
      } catch (cause) {
        reportError('No se pudo actualizar el módulo', cause)
        setSaveErrors((current) => ({
          ...current,
          [key]: 'No se guardó el cambio. Inténtalo de nuevo.',
        }))
        return false
      } finally {
        pendingRef.current.delete(key)
        setSaving(new Set(pendingRef.current))
      }
    },
    [modules, loading, error, setData],
  )

  return {
    modules,
    loading,
    error,
    refresh,
    saving,
    saveErrors,
    isEnabled,
    setModuleEnabled,
  }
}
