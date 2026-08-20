import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('customers').select('*').order('name')
    if (error) {
      toast.error('No se pudieron cargar los clientes', { description: error.message })
    } else {
      setCustomers(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCustomer = useCallback(
    async (values: CustomerInsert) => {
      const { data, error } = await supabase.from('customers').insert(values).select('*').single()
      if (error) {
        toast.error('No se pudo crear el cliente', { description: error.message })
        return null
      }
      toast.success('Cliente creado')
      await refresh()
      return data
    },
    [refresh],
  )

  const updateCustomer = useCallback(
    async (id: string, values: Partial<CustomerInsert>) => {
      const { error } = await supabase.from('customers').update(values).eq('id', id)
      if (error) {
        toast.error('No se pudo actualizar el cliente', { description: error.message })
        return false
      }
      toast.success('Cliente actualizado')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (customer: Customer) => updateCustomer(customer.id, { active: !customer.active }),
    [updateCustomer],
  )

  return { customers, loading, createCustomer, updateCustomer, toggleActive }
}
