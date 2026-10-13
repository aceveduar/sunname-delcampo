import type { ProductCategory } from './useCategories'

/** Recorre padres con límite por ID: tolera relaciones antiguas incompletas o cíclicas. */
export function categoryPath(id: string | null, categories: ProductCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return pathFromIndex(id, byId)
}

function pathFromIndex(
  id: string | null,
  byId: ReadonlyMap<string, ProductCategory>,
) {
  if (!id) return 'Categoría principal'
  const names: string[] = []
  const visited = new Set<string>()
  let current: string | null = id
  while (current) {
    if (visited.has(current)) {
      names.unshift('Revisar jerarquía')
      break
    }
    visited.add(current)
    const category = byId.get(current)
    if (!category) {
      names.unshift('Categoría no disponible')
      break
    }
    names.unshift(category.name + (category.active ? '' : ' (inactiva)'))
    current = category.parent_id
  }
  return names.join(' › ')
}

/** Evita ofrecer la propia categoría o alguno de sus descendientes como padre. */
export function categoryParentOptions(
  categories: ProductCategory[],
  editingId?: string,
) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const excluded = new Set<string>(editingId ? [editingId] : [])
  const children = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.parent_id) continue
    const siblings = children.get(category.parent_id) ?? []
    siblings.push(category.id)
    children.set(category.parent_id, siblings)
  }
  const pending = [...excluded]
  for (let i = 0; i < pending.length; i++) {
    for (const child of children.get(pending[i]) ?? []) {
      if (excluded.has(child)) continue
      excluded.add(child)
      pending.push(child)
    }
  }
  return categories
    .filter((category) => !excluded.has(category.id))
    .map((category) => ({
      value: category.id,
      label: pathFromIndex(category.id, byId),
    }))
}
