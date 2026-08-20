import { useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

type MovementType = Database['public']['Enums']['inventory_movement_type']

export function useRegisterMovement(onDone: () => void | Promise<void>) {
  return useCallback(
    async (values: { productId: string; type: MovementType; quantity: number; notes: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('inventory_movements').insert({
        product_id: values.productId,
        type: values.type,
        quantity: values.quantity,
        notes: values.notes,
        created_by: user?.id,
      })

      if (error) {
        toast.error('No se pudo registrar el movimiento', { description: error.message })
        return false
      }

      toast.success('Movimiento registrado')
      await onDone()
      return true
    },
    [onDone],
  )
}
