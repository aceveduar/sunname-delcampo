export function reportDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
export function reportDay(value: string, short = false) {
  const label = new Date(value + 'T12:00:00').toLocaleDateString(
    'es-MX',
    short
      ? { day: 'numeric', month: 'short' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  )
  return short ? label : label.charAt(0).toUpperCase() + label.slice(1)
}
