import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import type { Database } from '../../lib/database.types'

export type ProductCategory = Database['public']['Tables']['product_categories']['Row']
type CategoryInsert = Database['public']['Tables']['product_categories']['Insert']

export function useCategories() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('product_categories').select('*').order('name')
    if (error) {
      reportError('No se pudieron cargar las categorías', error)
    } else {
      setCategories(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCategory = useCallback(
    async (values: CategoryInsert) => {
      const { error } = await supabase.from('product_categories').insert(values)
      if (error) {
        reportError('No se pudo crear la categoría', error)
        return false
      }
      toast.success('Categoría creada')
      await refresh()
      return true
    },
    [refresh],
  )

  const updateCategory = useCallback(
    async (id: string, values: Partial<CategoryInsert>) => {
      const { error } = await supabase.from('product_categories').update(values).eq('id', id)
      if (error) {
        reportError('No se pudo actualizar la categoría', error)
        return false
      }
      toast.success('Categoría actualizada')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (category: ProductCategory) => updateCategory(category.id, { active: !category.active }),
    [updateCategory],
  )

  return { categories, loading, createCategory, updateCategory, toggleActive }
}
