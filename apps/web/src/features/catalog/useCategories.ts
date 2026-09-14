import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Database } from '../../lib/database.types'

export type ProductCategory = Database['public']['Tables']['product_categories']['Row']
type CategoryInsert = Database['public']['Tables']['product_categories']['Insert']

/** Valor de filtro/select para "sin categoría" -- category_id es nulo en
 * la base, pero un <select> nativo no puede tener un value null. Vive
 * aquí (no en un módulo de filtros o de formulario) porque cualquier
 * pantalla que filtre o edite por categoría lo necesita igual, dentro o
 * fuera de Catálogo (ej. Inventario). */
export const NO_CATEGORY = 'none'

export function useCategories() {
  const fetchCategories = useCallback(
    () => supabase.from('product_categories').select('*').order('name'),
    [],
  )
  const {
    items: categories,
    loading,
    refresh,
  } = useSupabaseList<ProductCategory>(fetchCategories, 'No se pudieron cargar las categorías')

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
