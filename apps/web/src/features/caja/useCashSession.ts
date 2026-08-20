import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import type { Database } from '../../lib/database.types'

export type CashSession = Database['public']['Tables']['cash_sessions']['Row']

export function useCashSession() {
  const [session, setSession] = useState<CashSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      reportError('No se pudo cargar el estado de caja', error)
    } else {
      setSession(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openSession = useCallback(
    async (openingAmount: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('cash_sessions')
        .insert({ opened_by: user.id, opening_amount: openingAmount })

      if (error) {
        reportError('No se pudo abrir la caja', error)
        return false
      }
      toast.success('Caja abierta')
      await refresh()
      return true
    },
    [refresh],
  )

  const closeSession = useCallback(
    async (closingAmount: number) => {
      if (!session) return false
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_by: user?.id,
          closed_at: new Date().toISOString(),
          closing_amount: closingAmount,
        })
        .eq('id', session.id)

      if (error) {
        reportError('No se pudo cerrar la caja', error)
        return false
      }
      toast.success('Caja cerrada')
      await refresh()
      return true
    },
    [session, refresh],
  )

  return { session, loading, openSession, closeSession }
}
