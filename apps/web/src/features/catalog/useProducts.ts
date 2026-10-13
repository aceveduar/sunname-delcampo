import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'
import { useSupabaseList } from '@/lib/useSupabaseList'
import { readAllPages } from '@/lib/readAllPages'
import type { Database } from '@/lib/database.types'

// La vista pública no expone costos. Su SELECT plano conserva los NOT NULL
// de products, aunque el generador de tipos no los propague a las vistas.
export type Product = Omit<
  Database['public']['Tables']['products']['Row'],
  'cost'
>
type ProductInsert = Database['public']['Tables']['products']['Insert']

export function useProducts() {
  const fetchProducts = useCallback(
    async () => ({
      data: (await readAllPages((from, to) =>
        supabase
          .from('product_catalog')
          .select('*', { count: 'exact' })
          .order('name')
          .order('id')
          .range(from, to),
      )) as Product[],
      error: null,
    }),
    [],
  )
  const {
    items: products,
    loading,
    error,
    refresh,
  } = useSupabaseList<Product>(
    fetchProducts,
    'No se pudieron cargar los productos',
  )

  // El ID permite seleccionar el alta desde la captura de compras por foto.
  const createProduct = useCallback(
    async (values: ProductInsert) => {
      const { data, error } = await supabase
        .from('products')
        .insert(values)
        .select('id')
        .single()
      if (error || !data) {
        reportError('No se pudo crear el producto', error)
        return null
      }
      toast.success('Producto creado')
      await refresh()
      return data.id
    },
    [refresh],
  )

  const updateProduct = useCallback(
    async (id: string, values: Partial<ProductInsert>) => {
      const { data, error } = await supabase
        .from('products')
        .update(values)
        .eq('id', id)
        .select('id')
        .single()
      if (error || !data) {
        reportError('No se pudo actualizar el producto', error)
        return false
      }
      toast.success('Producto actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (product: Product) =>
      updateProduct(product.id, { active: !product.active }),
    [updateProduct],
  )

  // Solo el formulario de administración consulta el costo puntual.
  const fetchCost = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('cost')
      .eq('id', id)
      .single()
    if (error || !data) {
      reportError('No se pudo cargar el costo', error)
      return null
    }
    return data.cost
  }, [])

  // Actualización por producto: un fallo parcial conserva los pendientes en el editor.
  const updatePrices = useCallback(
    async (
      changes: {
        id: string
        price: number
        price_per_100g: number | null
        active?: boolean
      }[],
    ) => {
      const results = await Promise.all(
        changes.map(({ id, ...values }) =>
          supabase
            .from('products')
            .update(values)
            .eq('id', id)
            .select('id')
            .single(),
        ),
      )
      const failed = results.filter((result) => result.error || !result.data)
      if (failed.length) {
        reportError(
          `No se pudieron actualizar ${failed.length} de ${changes.length} precios`,
          failed[0].error,
        )
      } else {
        toast.success(
          changes.length === 1
            ? 'Precio actualizado'
            : `${changes.length} precios actualizados`,
        )
      }
      await refresh()
      return failed.length === 0
    },
    [refresh],
  )

  // El servidor solo permite borrar productos sin historial de operaciones.
  const deleteProduct = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc('delete_product', {
        p_product_id: id,
      })
      if (error) {
        reportError('No se pudo borrar el producto', error)
        return false
      }
      toast.success('Producto borrado')
      await refresh()
      return true
    },
    [refresh],
  )

  return {
    products,
    loading,
    error,
    refresh,
    createProduct,
    updateProduct,
    updatePrices,
    toggleActive,
    deleteProduct,
    fetchCost,
  }
}
