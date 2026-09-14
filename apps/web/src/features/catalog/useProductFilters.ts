import { useMemo, useState } from 'react'
import { normalizeSearch } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'
import type { Product } from './useProducts'
import { NO_CATEGORY, type ProductCategory } from './useCategories'

type ActiveFilter = 'all' | 'active' | 'inactive'
type GranelFilter = 'all' | 'yes' | 'no'

/** Búsqueda + los 4 filtros de Catálogo + paginación, en un solo lugar --
 * separado de ProductsTab para que la pantalla no cargue con este estado
 * además de la del formulario y la tabla/tarjetas. */
export function useProductFilters(
  products: Product[],
  categories: ProductCategory[],
) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<ActiveFilter>('all')
  const [filterGranel, setFilterGranel] = useState<GranelFilter>('all')
  const [filterNoPrice, setFilterNoPrice] = useState(false)
  // Hoja de filtros: solo existe para el toolbar compacto de mobile --
  // en sm+ los 4 controles ya se ven inline, no hay nada que abrir.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeCategories = categories.filter((c) => c.active)

  const categoryFilterItems = [
    { value: 'all', label: 'Todas las categorías' },
    { value: NO_CATEGORY, label: 'Sin categoría' },
    ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
  ]
  const statusFilterItems = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ]
  const granelFilterItems = [
    { value: 'all', label: 'A granel: todos' },
    { value: 'yes', label: 'Solo a granel' },
    { value: 'no', label: 'Solo precio fijo' },
  ]
  const filtersActive =
    filterCategory !== 'all' ||
    filterActive !== 'all' ||
    filterGranel !== 'all' ||
    filterNoPrice
  const clearFilters = () => {
    setFilterCategory('all')
    setFilterActive('all')
    setFilterGranel('all')
    setFilterNoPrice(false)
  }

  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search)
    return products.filter((p) => {
      if (
        query &&
        !normalizeSearch(p.name).includes(query) &&
        !(p.sku && normalizeSearch(p.sku).includes(query))
      )
        return false
      if (filterCategory === NO_CATEGORY && p.category_id) return false
      if (
        filterCategory !== 'all' &&
        filterCategory !== NO_CATEGORY &&
        p.category_id !== filterCategory
      )
        return false
      if (filterActive === 'active' && !p.active) return false
      if (filterActive === 'inactive' && p.active) return false
      if (filterGranel === 'yes' && !p.sold_by_weight) return false
      if (filterGranel === 'no' && p.sold_by_weight) return false
      if (filterNoPrice && p.price !== 0) return false
      return true
    })
  }, [
    products,
    search,
    filterCategory,
    filterActive,
    filterGranel,
    filterNoPrice,
  ])

  const pagination = usePagination(filteredProducts)

  return {
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterActive,
    setFilterActive,
    filterGranel,
    setFilterGranel,
    filterNoPrice,
    setFilterNoPrice,
    filtersOpen,
    setFiltersOpen,
    categoryFilterItems,
    statusFilterItems,
    granelFilterItems,
    filtersActive,
    clearFilters,
    filteredProducts,
    ...pagination,
  }
}
