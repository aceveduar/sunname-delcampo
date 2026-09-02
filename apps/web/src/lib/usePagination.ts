import { useCallback, useMemo, useState } from 'react'

export function usePagination<T>(items: T[], pageSize = 25) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  // Cambiar de página sin mover el scroll deja la página nueva fuera de
  // vista cuando "Siguiente" se pulsó desde el fondo -- el usuario ve la
  // misma pantalla y no sabe si de verdad avanzó.
  const goToPage = useCallback((next: number) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    pageItems,
    page: currentPage,
    setPage: goToPage,
    totalPages,
    totalItems: items.length,
    pageSize,
  }
}
