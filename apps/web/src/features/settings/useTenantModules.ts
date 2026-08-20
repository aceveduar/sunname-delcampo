import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export type ModuleKey = 'crm' | 'purchasing' | 'billing'

export const MODULE_LABELS: Record<ModuleKey, { name: string; description: string }> = {
  crm: { name: 'Clientes (CRM)', description: 'Registrar clientes y ligarlos a una venta.' },
  purchasing: { name: 'Compras', description: 'Proveedores y órdenes de compra.' },
  billing: {
    name: 'Facturación',
    description: 'Factura fiscal CFDI 4.0 — todavía no construido en el sistema.',
  },
}

// Caja, Catálogo e Inventario son el núcleo del sistema (CLAUDE.md §5.1,
// plan "Básico") -- no se ofrecen como apagables desde aquí, aunque la
// tabla tenant_modules también tenga una fila para ellos.
export function useTenantModules(enabled = true) {
  const [modules, setModules] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const { data, error } = await supabase.from('tenant_modules').select('module_key, enabled')
    if (error) {
      toast.error('No se pudieron cargar los módulos', { description: error.message })
    } else {
      setModules(Object.fromEntries((data ?? []).map((m) => [m.module_key, m.enabled])))
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isEnabled = useCallback((key: ModuleKey) => modules[key] ?? false, [modules])

  const setModuleEnabled = useCallback(
    async (key: ModuleKey, enabled: boolean) => {
      const { error } = await supabase.from('tenant_modules').update({ enabled }).eq('module_key', key)
      if (error) {
        toast.error('No se pudo actualizar el módulo', { description: error.message })
        return false
      }
      toast.success(enabled ? 'Módulo activado' : 'Módulo desactivado')
      await refresh()
      return true
    },
    [refresh],
  )

  return { modules, loading, isEnabled, setModuleEnabled }
}
