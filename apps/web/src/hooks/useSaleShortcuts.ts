import { useEffect, useRef } from 'react'

/** Los atajos de Caja nunca deben actuar detrás de un diálogo. */
export function useSaleShortcuts({
  onSearch,
  onCheckout,
  onClearSearch,
  checkoutDisabled,
  dialogOpen,
}: {
  onSearch: () => void
  onCheckout: () => void
  onClearSearch: () => void
  checkoutDisabled: boolean
  dialogOpen: boolean
}) {
  const handlers = useRef({
    onSearch,
    onCheckout,
    onClearSearch,
    checkoutDisabled,
    dialogOpen,
  })
  useEffect(() => {
    handlers.current = {
      onSearch,
      onCheckout,
      onClearSearch,
      checkoutDisabled,
      dialogOpen,
    }
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = handlers.current
      if (
        event.defaultPrevented ||
        event.repeat ||
        current.dialogOpen ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return

      if (event.key === 'F2') {
        event.preventDefault()
        current.onSearch()
      } else if (event.key === 'F9') {
        event.preventDefault()
        if (!current.checkoutDisabled) current.onCheckout()
      } else if (event.key === 'Escape') {
        current.onClearSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
