export function sessionAge(openedAt: string, now: number) {
  const opened = new Date(openedAt)
  if (!Number.isFinite(opened.getTime())) return null
  const minutes = Math.max(0, Math.floor((now - opened.getTime()) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainder = minutes % 60
  const elapsed =
    days > 0
      ? days +
        (days === 1 ? ' día' : ' días') +
        (hours ? ' ' + hours + ' h' : '')
      : hours > 0
        ? hours + ' h' + (remainder ? ' ' + remainder + ' min' : '')
        : minutes > 0
          ? minutes + ' min'
          : 'menos de 1 min'
  const date =
    opened.toDateString() === new Date(now).toDateString()
      ? 'hoy'
      : 'el ' +
        opened.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
  const time = opened.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return {
    elapsed,
    openedLabel: date + ' a las ' + time,
    isLongRunning: minutes >= 1440,
  }
}
