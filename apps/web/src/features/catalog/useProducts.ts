import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) {
      toast.error('No se pudieron cargar los productos', { description: error.message })
    } else {
      setProducts(data ?? [])
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

  return { products, loading, createProduct, updateProduct, toggleActive }
}
