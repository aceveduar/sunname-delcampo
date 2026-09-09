import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { aliasKey } from './useSupplierAliases'
import type { Database } from '../../lib/database.types'

export type SupplierNameAlias =
  Database['public']['Tables']['supplier_name_aliases']['Row']

/** Nombres comerciales de proveedor ya confirmados aunque no se parezcan
 * a su razón social -- un mismo proveedor puede sellar un ticket con un
 * nombre distinto al de otro día (ver migración). Evita que el aviso
 * "¿No es este proveedor?" salga de nuevo para una elección que una
 * persona ya confirmó antes. */
export function useSupplierNameAliases() {
  const [aliases, setAliases] = useState<SupplierNameAlias[]>([])

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('supplier_name_aliases').select('*')
    if (error) {
      reportError('No se pudieron cargar los nombres de proveedor confirmados', error)
    } else {
      setAliases(data ?? [])
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** ¿Ya se confirmó antes que este texto de ticket es este proveedor? */
  const isConfirmed = useCallback(
    (supplierId: string, ticketText: string | null) => {
      if (!supplierId || !ticketText) return false
      const clave = aliasKey(ticketText)
      return aliases.some((a) => a.supplier_id === supplierId && a.ticket_text === clave)
    },
    [aliases],
  )

  /** El proveedor que ya se confirmó antes para este texto de ticket,
   * sin importar qué tan distinto se vea de su razón social. */
  const findSupplierId = useCallback(
    (ticketText: string | null) => {
      if (!ticketText) return null
      const clave = aliasKey(ticketText)
      return aliases.find((a) => a.ticket_text === clave)?.supplier_id ?? null
    },
    [aliases],
  )

  /** Guarda la confirmación. Un fallo aquí no debe tumbar la captura: la
   * orden ya se creó y es lo que de verdad importa -- esto solo evita
   * repetir la misma alerta la próxima vez. */
  const rememberSupplierName = useCallback(
    async (supplierId: string, ticketText: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('supplier_name_aliases').upsert(
        {
          supplier_id: supplierId,
          ticket_text: aliasKey(ticketText),
          created_by: user?.id ?? null,
        },
        { onConflict: 'supplier_id,ticket_text' },
      )

      if (error) {
        reportError('La compra se guardó, pero no se pudo recordar el nombre del proveedor', error)
        return
      }
      await refresh()
    },
    [refresh],
  )

  return { isConfirmed, findSupplierId, rememberSupplierName }
}
