import { useMemo, useState } from 'react'
import { normalizeSearch } from '@/lib/text'
import { usePagination } from '@/lib/usePagination'
import type { Product } from './useProducts'
import { NO_CATEGORY, type ProductCategory } from './useCategories'

type ActiveFilter = 'all' | 'active' | 'inactive'
type GranelFilter = 'all' | 'yes' | 'no'

export function useProductFilters(
  products: Product[],
  categories: ProductCategory[],
) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterActive, setFilterActive] = useState<ActiveFilter>('all')
  const [filterGranel, setFilterGranel] = useState<GranelFilter>('all')
  const [filterNoPrice, setFilterNoPrice] = useState(false)
  const [filterMissing, setFilterMissing] = useState<'all' | 'photo' | 'sku'>(
    'all',
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const categoryFilterItems = [
    { value: 'all', label: 'Todas las categorías' },
    { value: NO_CATEGORY, label: 'Sin categoría' },
    ...categories.map((category) => ({
      value: category.id,
      label: `${category.name}${category.active ? '' : ' (inactiva)'}`,
    })),
  ]
  const statusFilterItems = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ]
  const granelFilterItems = [
    { value: 'all', label: 'Todas las modalidades' },
    { value: 'yes', label: 'Solo a granel' },
    { value: 'no', label: 'Solo precio fijo' },
  ]
  const filtersActive =
    filterCategory !== 'all' ||
    filterActive !== 'all' ||
    filterGranel !== 'all' ||
    filterNoPrice ||
    filterMissing !== 'all'
  const filteredProducts = useMemo(() => {
    const tokens = normalizeSearch(search).split(/\s+/).filter(Boolean)
    return products.filter((product) => {
      const text = normalizeSearch(`${product.name} ${product.sku ?? ''}`)
      if (!tokens.every((token) => text.includes(token))) return false
      if (filterCategory === NO_CATEGORY && product.category_id) return false
      if (
        filterCategory !== 'all' &&
        filterCategory !== NO_CATEGORY &&
        product.category_id !== filterCategory
      )
        return false
      if (filterActive === 'active' && !product.active) return false
      if (filterActive === 'inactive' && product.active) return false
      if (filterGranel === 'yes' && !product.sold_by_weight) return false
      if (filterGranel === 'no' && product.sold_by_weight) return false
      if (filterNoPrice && product.price !== 0) return false
      if (filterMissing === 'photo' && product.image_url) return false
      if (filterMissing === 'sku' && product.sku?.trim()) return false
      return true
    })
  }, [
    products,
    search,
    filterCategory,
    filterActive,
    filterGranel,
    filterNoPrice,
    filterMissing,
  ])
  const pagination = usePagination(filteredProducts)
  const resetPage = () => {
    if (pagination.page > 1) pagination.setPage(1)
  }
  const clearFilters = () => {
    setSearch('')
    setFilterCategory('all')
    setFilterActive('all')
    setFilterGranel('all')
    setFilterNoPrice(false)
    setFilterMissing('all')
    resetPage()
  }
  return {
    search,
    setSearch: (value: string) => {
      setSearch(value)
      resetPage()
    },
    filterCategory,
    setFilterCategory: (value: string) => {
      setFilterCategory(value)
      resetPage()
    },
    filterActive,
    setFilterActive: (value: ActiveFilter) => {
      setFilterActive(value)
      resetPage()
    },
    filterGranel,
    setFilterGranel: (value: GranelFilter) => {
      setFilterGranel(value)
      resetPage()
    },
    filterNoPrice,
    setFilterNoPrice: (value: boolean) => {
      setFilterNoPrice(value)
      resetPage()
    },
    filterMissing,
    setFilterMissing: (value: typeof filterMissing) => {
      setFilterMissing(value)
      resetPage()
    },
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
