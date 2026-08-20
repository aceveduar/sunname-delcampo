import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type PaymentMethod = Database['public']['Tables']['payment_methods']['Row']

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])

  useEffect(() => {
    supabase
      .from('payment_methods')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setMethods(data ?? []))
  }, [])

  return methods
}
