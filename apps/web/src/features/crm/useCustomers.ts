import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import { useSupabaseList } from '../../lib/useSupabaseList'
import type { Database } from '../../lib/database.types'

export type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export function useCustomers() {
  const fetchCustomers = useCallback(
    () => supabase.from('customers').select('*').order('name'),
    [],
  )
  const {
    items: customers,
    loading,
    refresh,
  } = useSupabaseList<Customer>(fetchCustomers, 'No se pudieron cargar los clientes')

  const createCustomer = useCallback(
    async (values: CustomerInsert) => {
      const { data, error } = await supabase.from('customers').insert(values).select('*').single()
      if (error) {
        reportError('No se pudo crear el cliente', error)
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
        reportError('No se pudo actualizar el cliente', error)
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
