import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { normalizeSearch } from '../../lib/text'
import type { Database } from '../../lib/database.types'

export type SupplierAlias =
  Database['public']['Tables']['supplier_product_aliases']['Row']

/** La clave con la que se guarda y se busca lo que dijo el ticket. Se
 * normaliza (sin acentos, minúsculas, espacios colapsados) para que el
 * mismo producto empareje aunque el proveedor lo escriba distinto de una
 * semana a otra. */
export function aliasKey(ticketText: string) {
  return normalizeSearch(ticketText).replace(/\s+/g, ' ')
}

/** Equivalencias ticket -> catálogo aprendidas de capturas anteriores.
 *
 * La primera captura de un proveedor se hace a mano; al confirmarla se
 * guarda lo que la persona decidió, y de ahí en adelante sus tickets se
 * llenan solos. Mejora con el uso en vez de quedarse fijo. */
export function useSupplierAliases() {
  const [aliases, setAliases] = useState<SupplierAlias[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('supplier_product_aliases').select('*')
    if (error) {
      reportError('No se pudieron cargar las equivalencias de proveedor', error)
    } else {
      setAliases(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Busca lo que ya se aprendió para un renglón de este proveedor.
   * La clave del proveedor gana sobre la descripción cuando existe: es
   * más estable que el texto, que cambia de un ticket a otro. */
  const findAlias = useCallback(
    (supplierId: string, ticketText: string | null, supplierCode: string | null) => {
      if (!supplierId) return null
      const delProveedor = aliases.filter((a) => a.supplier_id === supplierId)
      if (supplierCode) {
        const porCodigo = delProveedor.find((a) => a.supplier_code === supplierCode)
        if (porCodigo) return porCodigo
      }
      if (!ticketText) return null
      const clave = aliasKey(ticketText)
      return delProveedor.find((a) => a.ticket_text === clave) ?? null
    },
    [aliases],
  )

  /** Guarda (o corrige) lo que la persona acabó eligiendo. Un fallo aquí
   * no debe tumbar la captura: la orden de compra ya se creó y es lo que
   * de verdad importa -- esto solo hace más rápida la próxima. */
  const rememberAliases = useCallback(
    async (
      entries: {
        supplierId: string
        ticketText: string
        supplierCode: string | null
        productId: string
        unitsPerPackage: number
      }[],
    ) => {
      if (entries.length === 0) return
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('supplier_product_aliases').upsert(
        entries.map((e) => ({
          supplier_id: e.supplierId,
          ticket_text: aliasKey(e.ticketText),
          supplier_code: e.supplierCode,
          product_id: e.productId,
          units_per_package: e.unitsPerPackage,
          created_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'supplier_id,ticket_text' },
      )

      if (error) {
        reportError('La compra se guardó, pero no se pudo recordar el emparejado', error)
        return
      }
      await refresh()
    },
    [refresh],
  )

  return { aliases, loading, findAlias, rememberAliases }
}
