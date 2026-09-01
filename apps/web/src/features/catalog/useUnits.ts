import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { reportError } from '../../lib/errors'
import type { Database } from '../../lib/database.types'

export type UnitOfMeasure = Database['public']['Tables']['units_of_measure']['Row']
type UnitInsert = Database['public']['Tables']['units_of_measure']['Insert']

export function useUnits() {
  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('units_of_measure').select('*').order('name')
    if (error) {
      reportError('No se pudieron cargar las unidades de medida', error)
    } else {
      setUnits(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createUnit = useCallback(
    async (values: UnitInsert) => {
      const { error } = await supabase.from('units_of_measure').insert(values)
      if (error) {
        reportError('No se pudo crear la unidad', error)
        return false
      }
      toast.success('Unidad creada')
      await refresh()
      return true
    },
    [refresh],
  )

  const updateUnit = useCallback(
    async (id: string, values: Partial<UnitInsert>) => {
      const { error } = await supabase.from('units_of_measure').update(values).eq('id', id)
      if (error) {
        reportError('No se pudo actualizar la unidad', error)
        return false
      }
      toast.success('Unidad actualizada')
      await refresh()
      return true
    },
    [refresh],
  )

  const toggleActive = useCallback(
    (unit: UnitOfMeasure) => updateUnit(unit.id, { active: !unit.active }),
    [updateUnit],
  )

  return { units, loading, createUnit, updateUnit, toggleActive }
}
