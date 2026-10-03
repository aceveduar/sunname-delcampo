import { useState } from 'react'
import { toast } from 'sonner'

export function favoritesKey(userId: string) {
  return (
    'sunname:favorites:v1:' +
    (import.meta.env.VITE_SUPABASE_URL ?? 'local') +
    ':' +
    userId
  )
}
export function useFavoriteProducts(userId: string) {
  const key = favoritesKey(userId)
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (id): id is string => typeof id === 'string' && id.length > 0,
              ),
            ),
          ].slice(0, 12)
        : []
    } catch {
      return []
    }
  })
  function toggle(id: string) {
    const next = ids.includes(id)
      ? ids.filter((value) => value !== id)
      : [...ids, id]
    if (next.length > 12) {
      toast.error(
        'Puedes fijar hasta 12 favoritos. Quita uno para añadir otro.',
      )
      return
    }
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setIds(next)
    } catch {
      toast.error('No se pudieron guardar tus favoritos en este navegador.')
    }
  }
  return { ids, toggle }
}
