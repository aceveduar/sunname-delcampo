import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

// products_select en RLS es admin-only (cost es información de margen
// -- CLAUDE.md §6 dice explícitamente que un cajero no debe verla).
// Todo lo que solo necesita listar/vender productos lee la vista
// product_catalog, que expone todo excepto cost. El costo real solo se
// pide aparte, bajo demanda, en el formulario de edición (admin-only).
//
// El tipo se toma de la tabla base (no del generado para la vista):
// Postgres no propaga NOT NULL a las columnas de una vista, así que el
// generador de tipos marca todo como nullable ahí -- pero sabemos que
// product_catalog es un select plano sin joins, con las mismas
// garantías de la tabla real.
export type Product = Omit<Database['public']['Tables']['products']['Row'], 'cost'>
type ProductInsert = Database['public']['Tables']['products']['Insert']

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('product_catalog').select('*').order('name')
    if (error) {
      toast.error('No se pudieron cargar los productos', { description: error.message })
    } else {
      setProducts((data ?? []) as Product[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createProduct = useCallback(
    async (values: ProductInsert) => {
      const { error } = await supabase.from('products').insert(values)
      if (error) {
        toast.error('No se pudo crear el producto', { description: error.message })
        return false
      }
      toast.success('Producto creado')
      await refresh()
      return true
    },
    [refresh],
  )

  const updateProduct = useCallback(
    async (id: string, values: Partial<ProductInsert>) => {
      const { error } = await supabase.from('products').update(values).eq('id', id)
      if (error) {
        toast.error('No se pudo actualizar el producto', { description: error.message })
        return false
      }
      toast.success('Producto actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (product: Product) => updateProduct(product.id, { active: !product.active }),
    [updateProduct],
  )

  // Solo para el formulario de edición (admin-only en la UI): el costo
  // no viaja en la lista general, se pide puntual para un producto.
  const fetchCost = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('products').select('cost').eq('id', id).single()
    if (error) {
      toast.error('No se pudo cargar el costo', { description: error.message })
      return null
    }
    return data.cost
  }, [])

  return { products, loading, createProduct, updateProduct, toggleActive, fetchCost }
}
