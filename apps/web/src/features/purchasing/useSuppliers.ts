import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type Supplier = Database['public']['Tables']['suppliers']['Row']
type SupplierInsert = Database['public']['Tables']['suppliers']['Insert']

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('suppliers').select('*').order('name')
    if (error) {
      toast.error('No se pudieron cargar los proveedores', { description: error.message })
    } else {
      setSuppliers(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createSupplier = useCallback(
    async (values: SupplierInsert) => {
      const { error } = await supabase.from('suppliers').insert(values)
      if (error) {
        toast.error('No se pudo crear el proveedor', { description: error.message })
        return false
      }
      toast.success('Proveedor creado')
      await refresh()
      return true
    },
    [refresh],
  )

  const updateSupplier = useCallback(
    async (id: string, values: Partial<SupplierInsert>) => {
      const { error } = await supabase.from('suppliers').update(values).eq('id', id)
      if (error) {
        toast.error('No se pudo actualizar el proveedor', { description: error.message })
        return false
      }
      toast.success('Proveedor actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (supplier: Supplier) => updateSupplier(supplier.id, { active: !supplier.active }),
    [updateSupplier],
  )

  return { suppliers, loading, createSupplier, updateSupplier, toggleActive }
}
