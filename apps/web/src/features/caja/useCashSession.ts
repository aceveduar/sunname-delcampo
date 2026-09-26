import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import type { Database } from '../../lib/database.types'

export type CashSession = Database['public']['Tables']['cash_sessions']['Row']

export function useCashSession() {
  const [session, setSession] = useState<CashSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      } else {
        setSession(data)
        setError(null)
      }
    } catch (cause) {
      setError('No se pudo cargar el estado de caja')
      reportError('No se pudo cargar el estado de caja', cause)
    } finally {
      setLoading(false)
    }
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
    async (
      closingAmount: number,
      notes: string | null,
      expectedAmount: number,
    ) => {
      if (!session) return false
      const { error } = await supabase.rpc('close_cash_session', {
        p_session_id: session.id,
        p_closing_amount: closingAmount,
        p_expected_amount: expectedAmount,
        p_notes: notes ?? undefined,
      })
      if (error) {
        reportError(
          error.code === 'P0001'
            ? error.message
            : 'No se pudo confirmar el cierre. Actualiza el estado de caja antes de reintentar.',
          error,
        )
        return false
      }
      toast.success('Caja cerrada')
      await refresh()
      return true
    },
    [session, refresh],
  )

  return { session, loading, error, refresh, openSession, closeSession }
}
