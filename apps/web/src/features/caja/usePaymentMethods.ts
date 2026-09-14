import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Database } from '../../lib/database.types'

export type PaymentMethod = Database['public']['Tables']['payment_methods']['Row']

export function usePaymentMethods() {
  const fetchMethods = useCallback(
    () => supabase.from('payment_methods').select('*').eq('active', true).order('name'),
    [],
  )
  // Antes esta consulta no reportaba error si fallaba -- caía en silencio
  // a "sin métodos de pago" sin que nadie se enterara, ni la persona
  // cobrando ni Sentry. useSupabaseList lo cierra gratis.
  return useSupabaseList<PaymentMethod>(fetchMethods, 'No se pudieron cargar los métodos de pago')
}
