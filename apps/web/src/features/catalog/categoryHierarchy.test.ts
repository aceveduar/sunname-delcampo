import { expect, it } from 'vitest'
import { categoryParentOptions, categoryPath } from './categoryHierarchy'
import type { ProductCategory } from './useCategories'

const categories: ProductCategory[] = [
  { id: 'root', name: 'Abarrotes', parent_id: null, active: true },
  { id: 'chiles', name: 'Chiles', parent_id: 'root', active: true },
  { id: 'secos', name: 'Secos', parent_id: 'chiles', active: true },
  { id: 'ancho', name: 'Ancho', parent_id: 'secos', active: true },
  { id: 'otro', name: 'Conservas', parent_id: 'root', active: false },
]
it('identifica la ruta completa y señala padres inactivos sin perder su nombre', () => {
  expect(categoryPath('secos', categories)).toBe('Abarrotes › Chiles › Secos')
  expect(categoryPath('otro', categories)).toBe(
    'Abarrotes › Conservas (inactiva)',
  )
  expect(categoryPath(null, categories)).toBe('Categoría principal')
})
it('excluye la propia categoría y todos sus descendientes, conservando otras ramas', () => {
  expect(
    categoryParentOptions(categories, 'chiles').map((option) => option.value),
  ).toEqual(['root', 'otro'])
  expect(categoryParentOptions(categories)).toHaveLength(5)
})
it('termina ante ciclos antiguos y relaciones incompletas, sin inventar un padre', () => {
  const broken = [{ ...categories[0], parent_id: 'chiles' }, categories[1]]
  expect(categoryPath('chiles', broken)).toContain('Revisar jerarquía')
  expect(categoryParentOptions(broken, 'root')).toEqual([])
  expect(categoryPath('missing', broken)).toBe('Categoría no disponible')
})
