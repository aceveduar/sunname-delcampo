export function errorMessage(error: unknown): string {
  const seen = new Set<unknown>()
  function read(value: unknown): string | null {
    if (typeof value === 'string')
      return value.trim() && value !== '[object Object]' ? value : null
    if (!value || typeof value !== 'object' || seen.has(value)) return null
    seen.add(value)
    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'cause']) {
      const message = read(record[key])
      if (message) return message
    }
    return null
  }
  return read(error) ?? 'Ocurrió un error inesperado. Intenta de nuevo.'
}
