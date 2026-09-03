import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
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
      reportError('No se pudieron cargar los productos', error)
    } else {
      setProducts((data ?? []) as Product[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Regresa el id del producto creado, o null si falló. Se necesita el id
   * (no un booleano) para poder dejarlo ya seleccionado en la captura de
   * compras por foto, sin obligar a buscarlo otra vez en la lista. */
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
      const { error } = await supabase.from('products').update(values).eq('id', id)
      if (error) {
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
    (product: Product) => updateProduct(product.id, { active: !product.active }),
    [updateProduct],
  )

  // Solo para el formulario de edición (admin-only en la UI): el costo
  // no viaja en la lista general, se pide puntual para un producto.
  const fetchCost = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('products').select('cost').eq('id', id).single()
    if (error) {
      reportError('No se pudo cargar el costo', error)
      return null
    }
    return data.cost
  }, [])

  // Para "Editar precios": varios productos a la vez, un solo refresh al
  // final -- updateProduct() uno por uno haría N refetches innecesarios.
  const updatePrices = useCallback(
    async (
      changes: { id: string; price: number; price_per_100g: number | null }[],
    ) => {
      const results = await Promise.all(
        changes.map(({ id, ...values }) =>
          supabase.from('products').update(values).eq('id', id),
        ),
      )
      const failed = results.filter((r) => r.error)
      if (failed.length > 0) {
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

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    updatePrices,
    toggleActive,
    fetchCost,
  }
}
