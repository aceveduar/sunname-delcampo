import * as React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Buscador con ícono y botón de limpiar -- sin esto, borrar una búsqueda
// para hacer la siguiente significa borrar letra por letra, algo que se
// nota mucho al dar de alta muchos productos seguidos.
const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
    value: string
    onChange: (value: string) => void
    containerClassName?: string
  }
>(({ value, onChange, className, containerClassName, ...props }, forwardedRef) => {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const setRefs = (el: HTMLInputElement | null) => {
    inputRef.current = el
    if (typeof forwardedRef === 'function') forwardedRef(el)
    else if (forwardedRef) forwardedRef.current = el
  }

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', containerClassName)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={setRefs}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('pl-8', value && 'pr-7', className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
})
SearchInput.displayName = 'SearchInput'

export { SearchInput }
