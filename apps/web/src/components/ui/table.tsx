import * as React from "react"

import { cn } from "@/lib/utils"

// En mobile una tabla ancha (Reportes, Inventario, Clientes...) sí se
// puede deslizar horizontalmente, pero nada lo indicaba -- se veía como
// si las columnas de la derecha simplemente estuvieran cortadas. Este
// degradado a los lados solo aparece cuando de verdad hay más contenido
// que ver, y desaparece al llegar al final del scroll.
function Table({ className, ...props }: React.ComponentProps<"table">) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const tableRef = React.useRef<HTMLTableElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateScrollShadows = React.useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    const table = tableRef.current
    if (!wrapper || !table) return
    updateScrollShadows()
    // El ancho que cambia con un filtro (menos/más filas, columnas que
    // se re-miden por su contenido) es el de <table>, no el del
    // wrapper -- observar solo el wrapper dejaba la sombra
    // desactualizada hasta el siguiente resize de ventana o scroll.
    const observer = new ResizeObserver(updateScrollShadows)
    observer.observe(table)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [updateScrollShadows])

  return (
    <div
      ref={wrapperRef}
      data-slot="table-container"
      onScroll={updateScrollShadows}
      className="relative w-full overflow-x-auto"
    >
      <table
        ref={tableRef}
        data-slot="table"
        className={cn("min-w-full caption-bottom text-sm", className)}
        {...props}
      />
      {canScrollLeft && (
        <div
          aria-hidden
          className="from-background pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r to-transparent"
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden
          className="from-background pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l to-transparent"
        />
      )}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
