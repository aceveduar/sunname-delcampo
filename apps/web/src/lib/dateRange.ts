export type ReportPreset = 'today' | 'week' | 'month' | 'custom'

export function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return localDateValue(date) === value ? date : null
}

/** `to` es exclusivo; el último día personalizado se incluye completo. */
export function reportRange(
  preset: ReportPreset,
  now: Date,
  start = '',
  end = '',
) {
  const from = preset === 'custom' ? parseLocalDate(start) : new Date(now)
  const to = preset === 'custom' ? parseLocalDate(end) : new Date(now)
  if (!from || !to || from > to) return null
  if (preset === 'custom') to.setDate(to.getDate() + 1)
  else {
    from.setHours(0, 0, 0, 0)
    if (preset === 'week') from.setDate(from.getDate() - 6)
    if (preset === 'month') from.setDate(1)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}
