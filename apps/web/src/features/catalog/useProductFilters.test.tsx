import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useProductFilters } from './useProductFilters'
import type { Product } from './useProducts'
import type { ProductCategory } from './useCategories'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const products = Array.from({ length: 60 }, (_, i) => ({
  id: String(i),
  name: 'Piñán de Chío ' + i,
  sku: 'MOL-' + i,
  category_id: 'archived',
  active: true,
  sold_by_weight: true,
  price: 0,
  image_url: null,
})) as Product[]
const categories = [
  { id: 'archived', name: 'Moles', active: false, parent_id: null },
] as ProductCategory[]
beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('encuentra palabras del nombre y código sin acentos, conservando categorías inactivas', () => {
  const { result } = renderHook(() => useProductFilters(products, categories))
  act(() => result.current.setSearch('chio pinan MOL-59'))
  expect(result.current.filteredProducts.map((p) => p.id)).toEqual(['59'])
  expect(result.current.categoryFilterItems).toContainEqual({
    value: 'archived',
    label: 'Moles (inactiva)',
  })
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it.each([
  'search',
  'category',
  'status',
  'weight',
  'price',
  'missing',
] as const)(
  'el filtro %s regresa a la primera página aunque queden varias páginas',
  (filter) => {
    const { result } = renderHook(() => useProductFilters(products, categories))
    act(() => result.current.setPage(2))
    expect(result.current.pageItems[0].id).toBe('25')
    act(() => {
      if (filter === 'search') result.current.setSearch('pinan')
      if (filter === 'category') result.current.setFilterCategory('archived')
      if (filter === 'status') result.current.setFilterActive('active')
      if (filter === 'weight') result.current.setFilterGranel('yes')
      if (filter === 'price') result.current.setFilterNoPrice(true)
      if (filter === 'missing') result.current.setFilterMissing('photo')
    })
    expect(result.current.totalPages).toBe(3)
    expect(result.current.page).toBe(1)
    expect(result.current.pageItems[0].id).toBe('0')
  },
)

it('limpia la búsqueda junto con todos los filtros', () => {
  const { result } = renderHook(() => useProductFilters(products, categories))
  act(() => {
    result.current.setSearch('inexistente')
    result.current.setFilterActive('inactive')
  })
  expect(result.current.totalItems).toBe(0)
  act(() => result.current.clearFilters())
  expect(result.current.search).toBe('')
  expect(result.current.filtersActive).toBe(false)
  expect(result.current.totalItems).toBe(60)
})
